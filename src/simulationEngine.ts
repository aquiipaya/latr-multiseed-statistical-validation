import type { UserConfig, Mode, EngineStepStats } from './types';

type Agent = {
  x: number;
  y: number;
  energy: number;
  vx: number;
  vy: number;
};

function clampNonNeg(x: number) {
  return x < 0 ? 0 : x;
}

export class SimulationEngine {
  public grid: Float32Array;
  public agents: Agent[] = [];

  private initialStock = 0;     // internal energy at importState
  private totalInflow = 0;      // cumulative external inflow
  private cumulativeHeat = 0;   // cumulative heat dissipated (diff + act)

  private stepHeatDiff = 0;     // this step diffusion heat
  private stepHeatAct = 0;      // this step activity heat

  private seed: number;
  private rngRandom: (() => number) | null = null;

  constructor(config: UserConfig) {
    this.seed = config.seed ?? 12345;
    this.grid = new Float32Array(config.gridSize * config.gridSize);
  }

  // deterministic PRNG
  private mulberry32(a: number) {
    return () => {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  public generateMasterState(config: UserConfig) {
    const localRng = this.mulberry32(config.seed);
    const size = config.gridSize;
    const grid = new Float32Array(size * size);
    const center = size / 2;

    for (let i = 0; i < grid.length; i++) {
      const x = i % size;
      const y = Math.floor(i / size);
      const dist = Math.sqrt((x - center) ** 2 + (y - center) ** 2);
      grid[i] = dist < config.initialSpread ? 15.0 : 1.0;
    }

    const agents: Agent[] = [];
    for (let i = 0; i < config.initialAgents; i++) {
      agents.push({
        x: localRng() * size,
        y: localRng() * size,
        energy: 2.0,
        vx: 0,
        vy: 0,
      });
    }

    return { grid, agents };
  }

  public importState(
    state: { grid: Float32Array; agents: Agent[] },
    mode: Mode
  ) {
    this.grid = new Float32Array(state.grid);
    this.agents =
      mode === 'off' ? [] : state.agents.map(a => ({ ...a }));

    this.cumulativeHeat = 0;
    this.totalInflow = 0;
    this.stepHeatDiff = 0;
    this.stepHeatAct = 0;

    // mode-separated RNG stream for random/life
    const modeSalt = mode === 'life' ? 777 : 999;
    this.rngRandom = this.mulberry32(this.seed + modeSalt);

    this.initialStock = this.getTotalInternalEnergy();
  }

  private getTotalInternalEnergy() {
    // sum in float64 (JS number)
    let sum = 0;
    for (let i = 0; i < this.grid.length; i++) sum += this.grid[i];
    for (let i = 0; i < this.agents.length; i++) sum += this.agents[i].energy;
    return sum;
  }

  public update(config: UserConfig & { mode: Mode }): EngineStepStats {
    this.stepHeatDiff = 0;
    this.stepHeatAct = 0;

    const size = config.gridSize;
    const centerIdx =
      Math.floor(size / 2) * size + Math.floor(size / 2);

    // external inflow
    this.grid[centerIdx] += config.inflowRate;
    this.totalInflow += config.inflowRate;

    // diffusion generates diffusion-heat
    this.applyStrictDiffusion(config.diffusionSpeed, config.diffusionCap);

    // agent dynamics generate activity-heat
    if (config.mode === 'life') this.updateLife(config);
    if (config.mode === 'random') this.updateRandom(config);

    const deltaHeat = this.stepHeatDiff + this.stepHeatAct;
    this.cumulativeHeat += deltaHeat;

    // energy audit: (internal + cumulativeHeat) should track (initialStock + totalInflow)
    const internal = this.getTotalInternalEnergy();
    const error =
      (internal + this.cumulativeHeat) - (this.initialStock + this.totalInflow);

    return {
      deltaHeat,
      totalHeat: this.cumulativeHeat,
      heatDiff: this.stepHeatDiff,
      heatAct: this.stepHeatAct,
      agentCount: this.agents.length,
      energyError: error,
    };
  }

  private applyStrictDiffusion(speed: number, cap: number) {
    const N = Math.sqrt(this.grid.length) | 0;
    const next = new Float32Array(this.grid);
    const friction = 0.1;

    // pairwise exchange (right & down) to avoid double counting
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const i = x + y * N;

        // neighbors: right and down
        const neighbors: number[] = [];
        if (x + 1 < N) neighbors.push(i + 1);
        if (y + 1 < N) neighbors.push(i + N);

        for (const j of neighbors) {
          const delta = this.grid[i] - this.grid[j];
          if (delta === 0) continue;

          const sIdx = delta > 0 ? i : j; // source
          const rIdx = delta > 0 ? j : i; // receiver

          const available = next[sIdx];
          if (available <= 0) continue;

          // flow bounded by gradient and available*cap
          const flow = Math.min(Math.abs(delta) * speed * 0.25, available * cap);
          if (flow <= 0) continue;

          const loss = flow * friction;         // diffusion heat
          const net = flow - loss;              // transferred energy

          next[sIdx] = (available - flow) as number;
          next[rIdx] = (next[rIdx] + net) as number;

          this.stepHeatDiff += loss;
        }
      }
    }

    // clamp (numerical safety)
    for (let k = 0; k < next.length; k++) next[k] = clampNonNeg(next[k]);
    this.grid = next;
  }

  private updateRandom(config: UserConfig) {
    const rng = this.rngRandom!;
    const N = Math.sqrt(this.grid.length) | 0;

    for (let idxA = 0; idxA < this.agents.length; idxA++) {
      const a = this.agents[idxA];

      // activity cost -> heatAct
      const cost = 0.5;
      const paid = Math.min(a.energy, cost);
      a.energy -= paid;
      this.stepHeatAct += paid;

      // take from grid (internal transfer)
      const gx = Math.floor(a.x);
      const gy = Math.floor(a.y);
      const gi = gx + gy * N;
      const take = Math.min(this.grid[gi], 0.5);
      this.grid[gi] = (this.grid[gi] - take) as number;
      a.energy += take;

      // random walk
      a.x = (a.x + (rng() - 0.5) * 4 + N) % N;
      a.y = (a.y + (rng() - 0.5) * 4 + N) % N;
    }
  }

  private updateLife(config: UserConfig) {
    const N = Math.sqrt(this.grid.length) | 0;
    const newborns: Agent[] = [];

    // per-agent step
    for (let idxA = 0; idxA < this.agents.length; idxA++) {
      const a = this.agents[idxA];

      // basal metabolism -> heatAct
      const basal = 0.45;
      const paid = Math.min(a.energy, basal);
      a.energy -= paid;
      this.stepHeatAct += paid;

      // feed from local cell (internal transfer)
      const gx = Math.floor(a.x);
      const gy = Math.floor(a.y);
      const gi = gx + gy * N;

      const take = Math.min(this.grid[gi], config.consumptionRate);
      this.grid[gi] = (this.grid[gi] - take) as number;
      a.energy += take;

      // choose direction by local gradient sampling (8 directions)
      let bestAng = Math.atan2(a.vy, a.vx);
      let maxE = -1;

      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        const sx = (Math.floor(a.x + Math.cos(ang) * 2) + N) % N;
        const sy = (Math.floor(a.y + Math.sin(ang) * 2) + N) % N;
        const e = this.grid[sx + sy * N];
        if (e > maxE) {
          maxE = e;
          bestAng = ang;
        }
      }

      a.vx = Math.cos(bestAng);
      a.vy = Math.sin(bestAng);

      // movement (internal model cost) -> heatAct
      const moveCost = 0.05;
      const paidMove = Math.min(a.energy, moveCost);
      a.energy -= paidMove;
      this.stepHeatAct += paidMove;

      a.x = (a.x + a.vx + N) % N;
      a.y = (a.y + a.vy + N) % N;
    }

    // death/reproduction phase
    const survivors: Agent[] = [];
    for (let idxA = 0; idxA < this.agents.length; idxA++) {
      const a = this.agents[idxA];

      // death: decompose energy back to grid (NOT heat), enabling strict cycling
      if (a.energy < 0.2) {
        const gx = Math.floor(a.x);
        const gy = Math.floor(a.y);
        const gi = gx + gy * N;
        this.grid[gi] = (this.grid[gi] + a.energy) as number;
        continue;
      }

      // reproduction: split energy, clone
      if (a.energy > 10) {
        a.energy *= 0.5;
        newborns.push({ ...a });
      }

      survivors.push(a);
    }

    this.agents = survivors.concat(newborns);
  }

  public draw(canvas: HTMLCanvasElement, mode: Mode) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const N = Math.sqrt(this.grid.length) | 0;
    const cell = canvas.width / N;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < this.grid.length; i++) {
      const v = Math.min(this.grid[i] * 15, 255);
      ctx.fillStyle = `rgb(0, ${v}, ${v * 0.5})`;
      ctx.fillRect((i % N) * cell, Math.floor(i / N) * cell, cell, cell);
    }

    for (let k = 0; k < this.agents.length; k++) {
      const a = this.agents[k];
      ctx.fillStyle = mode === 'life' ? '#ff00ff' : '#f1c40f';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(a.x * cell, a.y * cell, cell * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
}