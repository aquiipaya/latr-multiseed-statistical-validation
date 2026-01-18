# Statistical Validation of Life as a Thermodynamic Regulator
Multi-Seed Simulation and Reproducibility Package

This repository contains the exact simulator code, datasets, and figures used in the study:

**Statistical Validation of Life as a Thermodynamic Regulator:  
Multi-Seed Analysis of Dissipation-Channel Rewiring and Phase Transitions**  
Akihiko Itaya (2026)

The purpose of this repository is to ensure full computational reproducibility of the reported statistical phase diagrams and dissipation-channel analyses.


## Overview

This repository provides:

- Agent-based thermodynamic simulator (TypeScript, UI-based)
- Multi-seed parameter sweep implementation
- Aggregated CSV datasets used in the paper
- Cross-environment reproducibility verification data
- Figures included in the manuscript

This work statistically validates the hypothesis that biological agents reorganize dissipation channels and induce movable non-equilibrium phase transitions.


## Repository Structure

src/ Simulator source code (App.tsx, simulationEngine.ts, etc.)
data/
  main_results/           Main statistical results (seedCount = 30)
  reproducibility_check/  Cross-environment verification CSVs
figures/ Figures used in the paper
paper/ Manuscript (PDF)

### Execution Environment
The main statistical simulations (seedCount = 30) were executed using a cloud execution environment (Google AI Studio).

Cross-environment reproducibility was verified using a local PC with identical code and parameters
(see data/reproducibility_check/).

### Simulation Parameters (Paper)
 Inflow rates: {2, 4, 6, 8, 10}

 Consumption rates: {2, 4, 6, 8, 10}

 Seeds per condition: 30

 Time steps per run: 800

 Burn-in steps: 400

Total parameter points: 25

### How to Reproduce (UI-based)
Requirements
  Node.js >= 18
  npm

### Install

  npm install

### Run simulator

  npm start

 Then open: http://localhost:3000
 and configure the following parameters in the UI:

   Inflow min = 2

   Inflow max = 10

   Seed start = 0

   Seed count = 30

 Click Start Sweep to generate the multi-seed statistics.

### Output
The aggregated CSV file will be generated as:
   data/main_results/sweep_agg_seeds_30.csv

### Data Description
 data/main_results/sweep_agg_seeds_30.csv
  Aggregated statistics over 30 independent random seeds for each parameter pair.

 data/reproducibility_check/sweep_seed1_aistudio.csv

 data/reproducibility_check/sweep_seed1_mypc.csv

 Identical simulations (seedCount = 1) executed on:

    Google AI Studio

    Local PC

Used to confirm numerical reproducibility across environments.

### Figures
Figures included in figures/ correspond to:

 1. Movable critical inflow vs consumption curve

 2. Dissipation-channel allocation (diffusive fraction)

 3. Stochastic phase map: probability of accelerator regime

 4. Phase surface of dissipation ratio (LIFE / OFF)

### License
MIT License (or specify if different)

### Citation
If you use this code or data, please cite:

Itaya, A. (2026). Statistical Validation of Life as a Thermodynamic Regulator: Multi-Seed Analysis of Dissipation-Channel Rewiring and Phase Transitions.

### Contact
Independent Researcher
Akihiko Itaya


