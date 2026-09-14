import { ReportItem, AiOptimizationSetpoint } from '../types';

export const ASSETS = {
  operatorAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCHiO0Bs6ZfUtTNof6unWjxT6MC9ztJbixQxsLt4aKV9-j1r12v2Or7yn07BGlQ0nC97iwZtj6_am0e3Age6K9BmnBPho9sIJhHWHiFoEus85dJ_vQXleiZ9P7hDFLHWvrsKfKFmrmQr7LUOSs-Q0f-NTZWtDyQdpWkgYnQlgictv5bSsQHT1BltB35Thd0Y3KP62bVAdjW5k65L8nndOcHAQxsTMvl4CwRKz4GOBmZUIDLukFES5g',
  brandLogo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAWi3Xj8sNpLT7AnSskd7xic2Droare7JLqmt5uXHNgH0woqQBiOVTT7DQInMCvNXg2lA4_FYhCHUod544JdsqHdkpDyFkr0AFa0oAYi2ycFxwHI54nQTyu4vPZ4FItT0c3tChSfR9hnxo16kIilusbSv2_yBbQWozszmKeLrfVqnSVLZtiHp6wCk2WEXMEJtwxNHzyvaSfdUAZo2dO6vJJ7u0Q7w5Z41UFn3k_1Etrt9oPvIE58nY',
  operatorMobile: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC2_HKhh3CJqWPe0S0xGySESvIW0QoGUB_QXPCGtTR3oEm3OXdGbpy6NwWo_lFOO1h11LoGxcXM1Fzg5mrfa0zTt4QsiSRcIqNRyQX2t-uZo9UHjexdSfFGCikGcqSKrtylXpkU69_ccCCWa99FKxIsV--KV9SiE9tSRIQQ3ANa_mKBIUly_JdRtYdx5gE_wXL1DVnvRRg9yYEjjoqbobVW7yuqh0omHylgZ-121rxje-5gexdNP1Y',
  energyIcon: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAydcNXTKPLq2KsEaPzV10k1CoHNUJBIuJMUbB0VyoAjIfOs_mDX0sEgKIqZvH9MzJQ2_AcpBZN5I4DnDC5ZNUMNF0K_ZMFdWFHuwj39da-oXKyEazlbwgbeCetZwhiaqrw2htFa72aSVSS9H7FOyQxfizpNSfp1S46U9anI9OMN0HhdAf_mzsQlYiTEmK_-VjP9jUL-Iyq-ZovMSf6ab7AJQHNt2mQRM7zhuwNQqvRSGEZZCcYv5s',
  carbonIcon: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCYwB3XKBegaS9Cx_nXOhqZn9rKcIWthZzpPrZN7Hy5tttyHJHfO4XlxlbmyloaCNBTTHms05CV_qV0us-BltUyWUaIMlszK9715R0n07H-_gfS7ifw_Ml-p6ADO23aJ4SMLNoN-rIPQyVKzEYid2yVUcMKqQkQxZ3TShhQ2gjORT0GD6ZjtzLdN6wEofUkAz-A_ssPcv6lr1IR8NppB0Vdl97AST33iB4MIHp81lfRiNYdgnBfx_4',
  aiIcon: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBZ9GNWu9MN7COUTq3-RGLKwfQ83CyxUlr4H4qsp5QcCJDQZC-Fb0XhkMwN3RqD-clZUmSJtsjngSZlpZ-gkaMgp7OBaZKUGXCPhzhnwHo-yTJ81R8lH9Q8GrC61XQuddpgQcQgxQ9J9vu0-eLvzAD0ywWHxtz8SlVA0RCiYHTCfC3Oi9eog-Zuocwoa9Xa83_CYtsIPwI9ZbfDPmw3ozEPCOp6j7ZVDyvUtG8dCW779HAu-bl2heA'
};

export const INITIAL_REPORTS: ReportItem[] = [
  {
    id: 'rep-001',
    title: 'Daily Energy Consumables',
    category: 'OPERATIONS',
    description: "Comprehensive breakdown of electricity, steam, and natural gas usage across all production zones for yesterday's cycle.",
    status: 'ready',
    statusText: 'Generated 2h ago',
    generatedAt: '2026-08-30 01:12 UTC',
    fileFormat: 'PDF',
    iconType: 'energy',
    customIconUrl: ASSETS.energyIcon,
    fileSize: '4.2 MB',
    metricsSummary: [
      { label: 'Total Grid Energy', value: '48.2 MWh', change: '-3.4%', isPositive: true },
      { label: 'Steam Consumption', value: '112.6 k-lbs', change: '-1.8%', isPositive: true },
      { label: 'Natural Gas Usage', value: '18,450 Therms', change: '+0.5%', isPositive: false },
      { label: 'Specific Energy / Gal', value: '1.42 kWh/gal', change: '-4.1%', isPositive: true }
    ],
    detailedData: {
      executiveSummary: 'Yesterday\'s production cycle demonstrated robust thermal recovery across the Beer Column reboiler loop, achieving a 4.1% reduction in specific energy per denatured gallon produced. Grid consumption stayed below the peak tariff window between 14:00 and 18:00.',
      sections: [
        {
          title: 'Zone Consumption Breakdown',
          description: 'Sub-metered telemetry across fermentation, distillation, evaporation, and drying.',
          tableHeaders: ['Production Zone', 'Electricity (kWh)', 'Steam (k-lbs)', 'Gas (Therms)', 'Zone Efficiency'],
          tableRows: [
            ['Grain Handling & Milling', '8,420', '0', '0', '98.4%'],
            ['Mash & Liquefaction', '6,150', '28,400', '0', '95.2%'],
            ['Fermentation Hall (Tanks 1-8)', '12,900', '4,200', '0', '97.8%'],
            ['Distillation & Dehydration', '9,450', '68,200', '0', '99.1%'],
            ['DDGS Dryers & Evaporators', '11,280', '11,800', '18,450', '93.6%']
          ]
        },
        {
          title: 'Peak Load Mitigation Analysis',
          description: 'Automated peak shaving engaged for 180 minutes during high regional spot pricing.',
          notes: 'Prevented an estimated $3,840 in demand ratchet charges.'
        }
      ],
      aiKeyFindings: [
        'Distillation column reflux ratio optimization contributed 58% of yesterday\'s steam savings.',
        'Dryer exhaust heat recovery exchanger operates at 89.2% effectiveness; maintenance not due for 45 days.',
        'Chilled water loop pump #3 cycling observed under low wet-bulb ambient conditions.'
      ],
      sensorAnomalies: [
        'Minor sensor drift on Steam Flow Meter SFM-102 (+1.2% offset against condensate return).'
      ]
    }
  },
  {
    id: 'rep-002',
    title: 'Q3 Carbon & CO2e',
    category: 'COMPLIANCE',
    description: 'Regulatory compliance report detailing Scope 1 and Scope 2 emissions, offset calculations, and CI score projections.',
    status: 'ready',
    statusText: 'Generated Oct 1st',
    generatedAt: '2026-08-01 08:00 UTC',
    fileFormat: 'CSV',
    iconType: 'carbon',
    customIconUrl: ASSETS.carbonIcon,
    fileSize: '1.8 MB',
    metricsSummary: [
      { label: 'Calculated CI Score', value: '52.4 gCO2e/MJ', change: '-4.8 pts', isPositive: true },
      { label: 'Scope 1 Emissions', value: '14,280 MT', change: '-2.1%', isPositive: true },
      { label: 'Scope 2 Emissions', value: '4,620 MT', change: '-6.4%', isPositive: true },
      { label: 'CO2 Biogenic Capture', value: '28,950 MT', change: '+11.2%', isPositive: true }
    ],
    detailedData: {
      executiveSummary: 'Plant ETH-042 achieved an updated Carbon Intensity (CI) score of 52.4 gCO2e/MJ under the Low Carbon Fuel Standard (LCFS) model, outperforming California and Midwest baselines. Increased fermentation CO2 capture to the adjacent beverage-grade compression facility generated incremental credits.',
      sections: [
        {
          title: 'Emission Boundary Ledger',
          description: 'Third-party verifiable ledger compliant with GREET and ISO 14064 standards.',
          tableHeaders: ['Category', 'Fuel/Source', 'Gross MT CO2e', 'Offsets / Credits', 'Net Total MT'],
          tableRows: [
            ['Scope 1 - Stationary', 'Natural Gas Boilers', '12,850', '0', '12,850'],
            ['Scope 1 - Thermal Dryers', 'RTO & Flash Dryers', '1,430', '0', '1,430'],
            ['Scope 2 - Grid Electricity', 'Regional MISO Grid Mix', '4,620', '-1,200 (REC)', '3,420'],
            ['Biogenic CO2 Sequestration', 'Fermentation Vent Gas', '-28,950', '28,950 (LCFS)', '-28,950']
          ]
        }
      ],
      aiKeyFindings: [
        'CI score improved from 57.2 to 52.4 gCO2e/MJ primarily due to 96.8% uptime on the CO2 liquefaction pipeline.',
        'Renewable natural gas (RNG) co-fire feasibility study indicates potential 6.8 pt further CI reduction.',
        'EPA Title V continuous emission monitor (CEMS) recorded 100% compliant opacity and NOx profiles.'
      ]
    }
  },
  {
    id: 'rep-003',
    title: 'Predictive Maintenance',
    category: 'INTELLIGENCE',
    description: 'AI-driven analysis of centrifuge vibration data to forecast potential mechanical failures within the next 30 days.',
    status: 'generating',
    statusText: 'Est. 2 min remaining',
    generatedAt: 'In Progress...',
    fileFormat: 'PDF',
    iconType: 'ai',
    customIconUrl: ASSETS.aiIcon,
    fileSize: 'Computing...',
    metricsSummary: [
      { label: 'Monitored Assets', value: '48 Units', change: '100% telemetry', isPositive: true },
      { label: 'Vibration Anomalies', value: '1 Detected', change: 'Decanter Centrifuge #2', isPositive: false },
      { label: 'Predicted MTBF', value: '2,840 hrs', change: '+14%', isPositive: true }
    ],
    detailedData: {
      executiveSummary: 'AI machine-learning model is synthesizing high-frequency tri-axial accelerometer streams from 4 Decanter Centrifuges and 6 Boiler Feedwater Pumps. Spectral FFT analysis identifies harmonic signature shifts.',
      sections: [
        {
          title: 'Centrifuge Health Prognostics',
          description: 'Real-time bearing degradation curves and lubrication breakdown index.',
          tableHeaders: ['Equipment Tag', 'Vibration RMS (in/s)', 'Bearing Temp (°F)', 'Failure Probability (30d)'],
          tableRows: [
            ['CF-201 (Decanter #1)', '0.12', '142', '2.4% - Normal'],
            ['CF-202 (Decanter #2)', '0.38', '178', '41.8% - Bearing Warning'],
            ['CF-203 (Decanter #3)', '0.14', '139', '1.9% - Normal'],
            ['CF-204 (Decanter #4)', '0.11', '135', '1.1% - Normal']
          ]
        }
      ],
      aiKeyFindings: [
        'Decanter #2 drive-end bearing displays 1.2 kHz harmonics indicating outer race spalling initiation.',
        'Recommended maintenance window: Shift maintenance scheduled for Tuesday during planned CIP cycle.'
      ]
    }
  },
  {
    id: 'rep-004',
    title: 'Yield Variance Log',
    category: 'OPERATIONS',
    description: 'Detailed comparison of theoretical ethanol yield versus actual production volumes.',
    status: 'failed',
    statusText: 'Data missing from Sensor 4',
    generatedAt: '2026-08-29 23:45 UTC',
    fileFormat: 'PDF',
    iconType: 'yield',
    customIconUrl: ASSETS.energyIcon,
    fileSize: 'Failed',
    metricsSummary: [
      { label: 'Actual Starch Conversion', value: '98.1%', change: '+0.4%', isPositive: true },
      { label: 'Theoretical Yield', value: '2.94 gal/bu', change: 'Target 2.92', isPositive: true },
      { label: 'Actual Yield', value: '2.89 gal/bu', change: '-1.7%', isPositive: false },
      { label: 'Sensor 4 Status', value: 'Offline', change: 'Loss of 4-20mA loop', isPositive: false }
    ],
    detailedData: {
      executiveSummary: 'Report generation failed because Mass Flow Meter FM-104 (Sensor 4) in the Beer Feed line had an intermittent analog signal disconnect during the 18:00 - 22:00 telemetry batch. Click Retry Generation to run automated data imputation from downstream surge tank level delta.',
      sections: [
        {
          title: 'Sensor Health Diagnostics',
          description: 'Telemetric fault identification across Coriolis flowmeters.',
          tableHeaders: ['Sensor Tag', 'Channel', 'Heartbeat', 'Last Valid Reading'],
          tableRows: [
            ['FM-101 (Slurry Feed)', 'CH-01', 'Healthy', '100%'],
            ['FM-102 (Liquefaction)', 'CH-02', 'Healthy', '100%'],
            ['FM-103 (Fermenter Fill)', 'CH-03', 'Healthy', '100%'],
            ['FM-104 (Beer Well Discharge)', 'CH-04', 'FAULT', 'Signal Interrupted @ 18:14 UTC']
          ]
        }
      ],
      aiKeyFindings: [
        'Physical sensor loop wiring check recommended at junction box JB-12.',
        'AI fallback estimator can synthesize missing telemetry using Tank TK-201 level slope with 99.3% correlation.'
      ]
    }
  },
  {
    id: 'rep-005',
    title: 'Fermentation Batch #408 Compliance',
    category: 'COMPLIANCE',
    description: 'Bacterial infection screen, residual starch analysis, and final alcohol by volume (ABV) certification for Batch #408.',
    status: 'ready',
    statusText: 'Generated 5h ago',
    generatedAt: '2026-08-29 22:15 UTC',
    fileFormat: 'PDF',
    iconType: 'maintenance',
    customIconUrl: ASSETS.carbonIcon,
    fileSize: '3.1 MB',
    metricsSummary: [
      { label: 'Final Beer ABV', value: '14.82%', change: '+0.3%', isPositive: true },
      { label: 'Lactic Acid', value: '0.12% w/v', change: 'Well below 0.35% threshold', isPositive: true },
      { label: 'Acetic Acid', value: '0.04% w/v', change: 'Optimal', isPositive: true },
      { label: 'Fermentation Time', value: '54.2 hrs', change: '-3.8 hrs', isPositive: true }
    ],
    detailedData: {
      executiveSummary: 'Batch #408 in Fermenter F-03 completed with pristine microbiological health. Dual-action antimicrobial dosing prevented wild yeast or lactobacillus blooms, yielding peak final ethanol titer of 14.82% ABV.',
      sections: [
        {
          title: 'Fermentation Kinetics Log',
          description: 'Temperature, pH, Brix, and yeast viability progression across 56-hour curve.',
          tableHeaders: ['Elapsed Time', 'Temp (°F)', 'pH', 'Glucose (g/L)', 'Ethanol (% w/v)'],
          tableRows: [
            ['Hour 0 (Pitch)', '88.5', '5.4', '184.2', '0.0%'],
            ['Hour 12', '91.2', '4.8', '112.5', '4.2%'],
            ['Hour 24', '92.0', '4.5', '42.1', '8.9%'],
            ['Hour 36', '89.4', '4.3', '12.4', '12.7%'],
            ['Hour 54 (Drop)', '86.1', '4.2', '1.8', '14.82%']
          ]
        }
      ],
      aiKeyFindings: [
        'Optimal cooling jacket modulation at hour 18 prevented thermal shock.',
        'Enzyme glucoamylase dosage was precisely matched to corn grain bound starch levels.'
      ]
    }
  },
  {
    id: 'rep-006',
    title: 'Boiler Thermal & Steam Efficiency',
    category: 'OPERATIONS',
    description: 'Flue gas oxygen analysis, blowdown heat recovery coefficient, and steam-to-fuel ratio across Boilers B-1 and B-2.',
    status: 'ready',
    statusText: 'Generated Yesterday',
    generatedAt: '2026-08-29 14:00 UTC',
    fileFormat: 'CSV',
    iconType: 'energy',
    customIconUrl: ASSETS.energyIcon,
    fileSize: '2.4 MB',
    metricsSummary: [
      { label: 'Boiler 1 Efficiency', value: '84.8%', change: '+1.2%', isPositive: true },
      { label: 'Boiler 2 Efficiency', value: '83.9%', change: '+0.8%', isPositive: true },
      { label: 'Steam-to-Gas Ratio', value: '1.24 lbs/scf', change: '+2.5%', isPositive: true },
      { label: 'Condensate Return', value: '89.4%', change: '+3.1%', isPositive: true }
    ],
    detailedData: {
      executiveSummary: 'Automated trim control kept flue gas excess O2 between 2.1% and 2.4%, eliminating unburned hydrocarbon losses while preventing excessive stack heat dissipation.',
      sections: [
        {
          title: 'Steam Header Pressure & Flow',
          description: 'High-pressure 150# header and low-pressure 15# header balance.',
          tableHeaders: ['Header', 'Average PSI', 'Flow Rate (k-lbs/hr)', 'Superheat (°F)', 'Enthalpy (BTU/lb)'],
          tableRows: [
            ['HP Header (150#)', '148.5', '78.2', '365.4', '1,195.4'],
            ['LP Header (15#)', '15.2', '34.8', '250.1', '1,162.0'],
            ['Economizer Exit', '14.8', '12.4', '210.0', '180.2']
          ]
        }
      ],
      aiKeyFindings: [
        'Continuous surface blowdown heat exchanger saved 1,420 MMBtu over the past 7 days.',
        'Deaerator dissolved oxygen remains below 3 ppb.'
      ]
    }
  }
];

// PLANT_ALARMS lived here: three invented alarms (a centrifuge bearing, a beer
// well sensor, a grid tariff window) that Overview and the bell popover both
// listed and that no reading could ever change. Alarms are now derived from the
// operator's own out-of-band readings in lib/plantAlarms.ts.

// Illustrative setpoints for levers the app does not model. Reflux is
// deliberately NOT in this list: lib/distillationEngine.ts is the single source
// of truth for it, and the scenario table on the same screen derives the reflux
// recommendation there. A mock reflux card used to sit here suggesting 1.85 ->
// 1.72 while the engine below said 3.1 -> 2.5, which put two contradictory
// answers on one screen. Keep reflux out of here.
export const AI_SETPOINTS: AiOptimizationSetpoint[] = [
  {
    id: 'sp-2',
    parameter: 'Glucoamylase Dosing Pump Speed',
    unit: 'mL/min',
    currentValue: 142.0,
    recommendedValue: 136.5,
    expectedGain: 'Maintain 98.4% starch conversion while cutting enzyme cost by $620/day',
    confidence: 94.8,
    safetyMargin: 'Corn kernel starch profile confirmed at 71.2%',
    status: 'pending'
  },
  {
    id: 'sp-3',
    parameter: 'Chilled Water Supply Temperature',
    unit: '°F',
    currentValue: 46.0,
    recommendedValue: 49.5,
    expectedGain: '-8.5% chiller compressor electric power',
    confidence: 98.1,
    safetyMargin: 'Ambient wet bulb is 54°F (safe for fermentation cooling load)',
    status: 'applied'
  }
];
