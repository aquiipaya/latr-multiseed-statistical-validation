export type SweepStatus = 'suppressor' | 'accelerator' | 'dead' | 'invalid';

export type Mode = 'off' | 'random' | 'life';

export interface UserConfig {
  gridSize: number;
  inflowRate: number;
  consumptionRate: number;
  diffusionSpeed: number;
  diffusionCap: number;
  initialAgents: number;
  initialSpread: number;
  seed: number;
}

export interface EngineStepStats {
  deltaHeat: number;
  totalHeat: number;
  heatDiff: number;
  heatAct: number;
  agentCount: number;
  energyError: number;
}

export interface CompareStats {
  tick: number;

  // OFF
  deltaHeat_off: number;
  totalHeat_off: number;
  agent_off: number;
  heatDiff_off: number;
  heatAct_off: number;
  energyErr_off: number;

  // RANDOM
  deltaHeat_random: number;
  totalHeat_random: number;
  agent_random: number;
  heatDiff_random: number;
  heatAct_random: number;
  energyErr_random: number;

  // LIFE
  deltaHeat_life: number;
  totalHeat_life: number;
  agent_life: number;
  heatDiff_life: number;
  heatAct_life: number;
  energyErr_life: number;
}

export interface SweepPoint {
  inflowRate: number;
  consumptionRate: number;
}

export interface SweepResult {
  inflowRate: number;
  consumptionRate: number;

  avg_delta_off: number;
  avg_delta_life: number;
  ratio_life_off: number;

  avg_heatDiff_life: number;
  avg_heatAct_life: number;

  avg_agents_life: number;
  avg_agents_random: number;

  energyErr_life_min: number;
  energyErr_life_max: number;

  status: SweepStatus;
}