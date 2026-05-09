// ── DATA STORE ─────────────────────────────────────────────────────────────────
// Single source of truth. Every editable value lives here.
// Computed values live in C (see compute.js).

const D = {
  project: {
    name: 'Regalium',
    subtitle: 'CONSTRUCTION COST DASHBOARD',
    asAtDate: '30 Dec 2025'
  },

  os: {
    rows: [
      // curDirect: null = value derived from sheet; non-null = directly editable
      // expFixed:  null = mirrors current; non-null = hard-coded expected
      { sno: 1,  label: 'EXCAVATION, SHORING & CIVIL WORKS',          init: 308.2, curDirect: 283.0,       expFixed: null  },
      { sno: 2,  label: 'INTERIOR & COMMON AREA FINISHING WORK',       init: 76.8,  curDirect: null,        expFixed: 95    },
      { sno: 3,  label: 'LIGHTING',                                    init: 14.4,  curDirect: null,        expFixed: 14.4  },
      { sno: 4,  label: 'FAÇADE WORK',                                 init: 66.5,  curDirect: null,        expFixed: 84.5  },
      { sno: 5,  label: 'MEPF/SERVICES WORK',                          init: 96.2,  curDirect: null,        expFixed: null  },
      { sno: 6,  label: 'ELEVATORS',                                   init: 17.6,  curDirect: null,        expFixed: null  },
      { sno: 7,  label: 'PARKING',                                     init: 12.4,  curDirect: null,        expFixed: null  },
      { sno: 8,  label: 'SMART BUILDING SYSTEM',                       init: 13.3,  curDirect: 13.2875279,  expFixed: null  },
      { sno: 9,  label: 'EXTERNAL DEVELOPMENT / LANDSCAPE',            init: 22.4,  curDirect: null,        expFixed: null  },
      { sno: 10, label: 'SIGNAGES',                                    init: 3.6,   curDirect: null,        expFixed: 5     },
      { sno: 11, label: 'FIRE DOORS',                                  init: null,  curDirect: 2.4,         expFixed: 2.4   },
      { sno: 12, label: 'RETAIL & OFFICE SHOPFRONT',                   init: null,  curDirect: null,        expFixed: 2     },
      { sno: 13, label: 'CONSULTANT',                                  init: 32.1,  curDirect: null,        expFixed: null  },
    ],
    contingencyInit: 15.8,
    labourInit: 3.2,
    notes: {
      2: 'Current: Finishes 01 (13.3 Cr) + Finishes 02 (63.2 Cr). Expected: 95 Cr',
      3: 'Façade & landscape lighting 6.5 + Interiors 7.0 + BOH 0.9 = 14.4 Cr',
      4: 'Current: Alufit 75.5 + SKK 5.9. Expected: Alufit 79.6 + SKK 5.9 = 84.5 Cr',
    }
  },

  facade: {
    rows: [
      { sno: '1',   type: 'FT-01',    desc: 'Façade System (Typical floors, Unitised CW)',        qty: 8195.73, rate: 10859.26 },
      { sno: '1.2', type: 'FT-01',    desc: 'Vision Glass V-1A & V-1A(C) — DGU 6mm HS',           qty: 4444.20, rate: 3187     },
      { sno: '1.3', type: 'FT-01',    desc: 'Vision Glass – Openable panels V-1A(O)',              qty: 343.20,  rate: 9384     },
      { sno: '1.4', type: 'FT-01',    desc: 'Vision Glass V-1B (Curved)',                          qty: 112.80,  rate: 8120     },
      { sno: '1.5', type: 'FT-01',    desc: 'Spandrel Glass S-1A & S-1A(C)',                       qty: 793.47,  rate: 1489     },
      { sno: '1.6', type: 'FT-01',    desc: 'Spandrel Glass S-1B (Curved)',                        qty: 15.44,   rate: 3794     },
      { sno: '1.7', type: 'FT-01',    desc: 'Shadow Box behind Spandrel Glass',                    qty: 808.60,  rate: 5590     },
      { sno: '1.8', type: 'FT-01A/D', desc: 'Shadow Box behind GRC Spandrel & Fin',               qty: 2486.93, rate: 5240     },
      { sno: '1.9', type: 'FT-01',    desc: 'Back Panel (2mm GI)',                                 qty: 3295.53, rate: 2292     },
      { sno: '2',   type: 'FT-01E',   desc: 'Façade System (8th & 9th floor)',                     qty: 1982.44, rate: 10910.75 },
      { sno: '2.2', type: 'FT-01E',   desc: 'Vision Glass V-2A & V-2B',                           qty: 1075.09, rate: 3187     },
      { sno: '2.3', type: 'FT-01E',   desc: 'Vision Glass – Openable V-2A(O) & V-2B(O)',          qty: 87.19,   rate: 9109     },
      { sno: '2.4', type: 'FT-01E',   desc: 'Spandrel Glass S-2A & S-2B',                         qty: 348.77,  rate: 1489     },
      { sno: '2.5', type: 'FT-01E',   desc: 'Shadow Box behind Spandrel Glass',                    qty: 348.77,  rate: 5590     },
      { sno: '3',   type: 'FT-02',    desc: 'Façade System (8th & 9th NW, Double Storey CW)',      qty: 848.18,  rate: 11125.05 },
      { sno: '3.2', type: 'FT-02A',   desc: 'Vision Glass V-2E & V-2F',                           qty: 509.00,  rate: 3187     },
    ],
    remaining: 641244454.33   // balance of full 322-row BOQ not shown in table
  },

  parking: {
    rows: [
      { sno: '1.1a', label: 'Puzzle 2-Level (Type 02B) — 5 Grid / 9 Modules', unit: 'Spaces', qty: 243,  rate: 130000 },
      { sno: '1.1b', label: 'Puzzle 2-Level (Type 02B) — 3 Grid / 5 Modules', unit: 'Spaces', qty: 10,   rate: 130000 },
      { sno: '2.1',  label: 'Stack 2-Level (Type 02A, 2.0T) — B1',            unit: 'Spaces', qty: 166,  rate: 55500  },
      { sno: '2.1a', label: 'Stack 2-Level (Type 02B, 2.0T) — B2 & B3',       unit: 'Spaces', qty: 690,  rate: 55500  },
    ],
    gstRate: 0.18
  },

  landscape: {
    groups: [
      { key: 'A', label: 'Road Works',                  amt: 24807500.62  },
      { key: 'B', label: 'Compound Wall Works',          amt: 25000000     },
      { key: 'C', label: 'External Landscape Works',     amt: 41208000     },
      { key: 'D', label: 'Internal Landscape Works',     amt: 9969287.50   },
      { key: 'E', label: 'Balcony/Deck Landscape Works', amt: 24930000     },
    ],
    details: [
      { sno: 'A.1',  label: 'Drive Way – Paver blocks',                             unit: 'Sqm', qty: 2878,  rate: 2137.14  },
      { sno: 'A.2',  label: 'Granite stone – Drive Way Dropoff Area',               unit: 'Sqm', qty: 2710,  rate: 5100     },
      { sno: 'A.3',  label: 'Granite stone – Pathway Main Entrance',                unit: 'Sqm', qty: 442,   rate: 5100     },
      { sno: 'A.4',  label: 'Paver block – Pathway',                                unit: 'Sqm', qty: 455,   rate: 2137.14  },
      { sno: 'A.5',  label: 'Kerb stone',                                           unit: 'Rmt', qty: 1185,  rate: 1200     },
      { sno: 'A.6',  label: 'Cross Drain',                                          unit: 'Rmt', qty: 104,   rate: 1800     },
      { sno: 'B.1',  label: 'Enhancement of boundary wall',                         unit: 'LS',  qty: 1,     rate: 25000000 },
      { sno: 'C.1',  label: 'Hardscape Ground Floor (planter wall, steps, coping)', unit: 'Sqm', qty: 617,   rate: 11000    },
      { sno: 'C.2',  label: 'Landscape & Horticulture Ground Floor',                unit: 'Sqm', qty: 265,   rate: 14000    },
      { sno: 'C.3',  label: 'Water Fall Wall',                                      unit: 'LS',  qty: 1,     rate: 5000000  },
      { sno: 'C.4',  label: 'Green Wall',                                           unit: 'Sqm', qty: 782,   rate: 10500    },
      { sno: 'C.5',  label: 'Feature Wall',                                         unit: 'LS',  qty: 1,     rate: 3000000  },
      { sno: 'C.6',  label: 'Entrance Gate & Security Cabin, Entrance Portal',      unit: 'LS',  qty: 1,     rate: 12500000 },
      { sno: 'C.7',  label: 'Landscape Irrigation – External',                      unit: 'LS',  qty: 1,     rate: 2000000  },
      { sno: 'D.1',  label: 'Seating Planters – Gallery Entrance',                  unit: 'Rmt', qty: 14.44, rate: 13000    },
      { sno: 'D.2',  label: 'Green Wall – Gallery Entrance',                        unit: 'Sqm', qty: 16.89, rate: 25000    },
      { sno: 'D.10', label: 'Water and Rock Garden',                                unit: 'Sqm', qty: 30.99, rate: 50000    },
      { sno: 'D.14', label: 'Hardscape',                                            unit: 'LS',  qty: 1,     rate: 4000000  },
      { sno: 'E.2',  label: 'Balcony Area Hardscape',                               unit: 'Sqm', qty: 1190,  rate: 12000    },
    ],
    otherItems: 97660738.93   // balance of 73-row BOQ not shown in table
  },

  finishes: {
    rows: [
      { sno: 1, label: 'Finishes 01 – Basements (BOQ)',        amt: 139267570.63 },
      { sno: 2, label: 'Finishes 02 – Premium Finishes (BOQ)', amt: 627900000    },
    ]
  },

  lighting: {
    rows: [
      { sno: 1, label: 'Façade Lighting / Landscape Lighting',   exclGst: 59322000, inclGst: 70000000 },
      { sno: 2, label: 'Architectural Decorative Light Fixture', exclGst: 55085000, inclGst: 65000000 },
      { sno: 3, label: 'Overall Building Light Fixture',         exclGst: 7627000,  inclGst: 9000000  },
    ]
  },

  mepf: {
    rows: [
      { sno: 1,   label: 'MEPF Tender Works',                         amt: 696200000, status: 'Already awarded',    cls: 'awarded'  },
      { sno: 2,   label: 'Lightning protection system',               amt: 7788000,   status: 'Already awarded',    cls: 'awarded'  },
      { sno: 3,   label: 'Diesel Generator',                          amt: 125000000, status: 'Tender in progress', cls: 'progress' },
      { sno: 4,   label: 'Chiller',                                   amt: 61000000,  status: 'Tender in progress', cls: 'progress' },
      { sno: 5,   label: 'STP',                                       amt: 11850000,  status: 'Already awarded',    cls: 'awarded'  },
      { sno: '—', label: 'Micron – NT item (7 MVA→8.2 MVA increase)', amt: 20000000,  status: 'Revision',           cls: 'progress' },
      { sno: '—', label: 'Micron – HVAC Air Handling Unit',           amt: 9700000,   status: 'Revision',           cls: 'progress' },
      { sno: '—', label: 'FS Cabling',                                amt: 10000000,  status: 'Revision',           cls: 'progress' },
      { sno: '—', label: 'Electrical HT Works',                       amt: 15000000,  status: 'Revision',           cls: 'progress' },
    ]
  },

  elevators: {
    main: [
      { sno: 1, desc: 'Office Elevators (Passenger)',     tot: 14, cA: 7,  cB: 7,   amtCr: 8.1 },
      { sno: 2, desc: 'Retail Elevators (Passenger)',     tot: 4,  cA: 2,  cB: 2,   amtCr: 2.2 },
      { sno: 3, desc: 'Service Elevators (Office/Retail)',tot: 3,  cA: 1,  cB: 2,   amtCr: 1.8 },
      { sno: 4, desc: 'Banquet Service Elevators',        tot: 1,  cA: 1,  cB: null, amtCr: 0.4 },
    ],
    oos: [
      { sno: 1, label: 'Hydraulic Elevator',              amt: 2800000  },
      { sno: 2, label: 'Interior Finishes',               amt: 8000000  },
      { sno: 3, label: 'Retail Platform Aesthetic Lifts', amt: 30000000 },
    ],
    exclGst: 146720000,
    gstRate: 0.18
  },

  signages: {
    rows: [
      { sno: 1, label: 'Retail Signages',                                              amt: 11720000 },
      { sno: 2, label: 'Office Signages',                                              amt: 798000   },
      { sno: 3, label: 'Basement Signages',                                            amt: 1276650  },
      { sno: 4, label: 'External Development Signages',                                amt: 5305000  },
      { sno: 5, label: 'Parking Marking, Speed Breaker, Car Stopper, Edge Protection', amt: 10990420 },
    ],
    gstRate: 0.18
  },

  consultant: {
    main: [
      { sno: 5,  label: 'Façade Engineering Consultant',          amt: 10880000 },
      { sno: 7,  label: 'Green Building',                         amt: 2950000  },
      { sno: 8,  label: 'Vertical Transport Consultancy (Lifts)', amt: 1290000  },
      { sno: 9,  label: 'RPWD',                                   amt: 1500000  },
      { sno: 10, label: 'BOH Consultant',                         amt: 1550000  },
      { sno: 11, label: 'Acoustics Consultant 3DB AV',            amt: 4400000  },
      { sno: 12, label: 'Acoustic Consultant Sonics',             amt: 750000   },
      { sno: 13, label: 'Security Assessment',                    amt: 3151500  },
      { sno: 14, label: 'Traffic Consultant',                     amt: 950000   },
      { sno: 15, label: 'Inkers',                                 amt: 8100000  },
      { sno: 16, label: 'Cost Consultant',                        amt: 4000000  },
      { sno: 17, label: 'Interior Design – Retail Spaces, Hotels',amt: 42300000 },
      { sno: 18, label: 'Landscape Consultant',                   amt: 14000000 },
      { sno: 19, label: 'Lighting Consultant',                    amt: 36441000 },
      { sno: 20, label: 'BMS Consultant',                         amt: 4000000  },
      { sno: 21, label: 'Signage Consultant',                     amt: 1000000  },
      { sno: 22, label: 'Interiors BOQ Consultant',               amt: 1090000  },
      { sno: 23, label: 'Other Consultants',                      amt: 32500000 },
    ],
    struct: [
      { label: 'Structural Consultant',             amt: 21250000 },
      { label: 'PT Consultant',                     amt: 1312500  },
      { label: 'Structural Peer Review Consultant', amt: 1460087  },
      { label: 'MEP Peer Review Consultant',        amt: 3000000  },
      { label: 'Lead MEPFS Consultant',             amt: 10040000 },
      { label: 'PMC',                               amt: 61864000 },
      { label: 'Other Consultants',                 amt: 1500000  },
    ],
    gstRate: 0.18
  },

  summary3: { artWorks: 10.0, notes: '' },

  smartsheet: {
    apiKey: '',
    tables: [
      {
        id: 'ss_demo',
        name: 'Cost Analysis — Quick Calculator',
        cols: [
          { id: 'item',    label: 'Item'           },
          { id: 'qty',     label: 'Qty'            },
          { id: 'rate',    label: 'Rate (₹)'       },
          { id: 'amount',  label: 'Amount (₹)'     },
          { id: 'gst',     label: 'GST @18% (₹)'  },
          { id: 'total',   label: 'Total Incl. GST'},
          { id: 'amt_cr',  label: 'Amount (Cr)'    },
          { id: 'notes',   label: 'Notes'          },
        ],
        rows: [
          {
            id: 'ss_r0',
            cells: {
              item:   { val: 'Civil & Structural',  formula: null,            comment: 'As per structural consultant BOQ, Dec 2025' },
              qty:    { val: 1,                     formula: null,            comment: '' },
              rate:   { val: 283000000,             formula: null,            comment: 'Committed amount — revised Dec 2025' },
              amount: { val: null,                  formula: '=qty*rate',     comment: '' },
              gst:    { val: null,                  formula: '=amount*0.18',  comment: '' },
              total:  { val: null,                  formula: '=amount+gst',   comment: '' },
              amt_cr: { val: null,                  formula: '=total/10000000', comment: '' },
              notes:  { val: 'Committed',           formula: null,            comment: '' },
            }
          },
          {
            id: 'ss_r1',
            cells: {
              item:   { val: 'Façade Work',         formula: null,            comment: '' },
              qty:    { val: 1,                     formula: null,            comment: '' },
              rate:   { val: 845000000,             formula: null,            comment: '' },
              amount: { val: null,                  formula: '=qty*rate',     comment: '' },
              gst:    { val: null,                  formula: '=amount*0.18',  comment: '' },
              total:  { val: null,                  formula: '=amount+gst',   comment: '' },
              amt_cr: { val: null,                  formula: '=total/10000000', comment: '' },
              notes:  { val: 'In Progress',         formula: null,            comment: '' },
            }
          },
          {
            id: 'ss_r2',
            cells: {
              item:   { val: 'MEPF Services',       formula: null,            comment: '' },
              qty:    { val: 1,                     formula: null,            comment: '' },
              rate:   { val: 937333708,             formula: null,            comment: 'GLEEDS R5 estimate' },
              amount: { val: null,                  formula: '=qty*rate',     comment: '' },
              gst:    { val: null,                  formula: '=amount*0.18',  comment: '' },
              total:  { val: null,                  formula: '=amount+gst',   comment: '' },
              amt_cr: { val: null,                  formula: '=total/10000000', comment: '' },
              notes:  { val: 'Tender in Progress',  formula: null,            comment: '' },
            }
          },
          {
            id: 'ss_r3',
            cells: {
              item:   { val: 'TOTAL',               formula: null,            comment: '' },
              qty:    { val: null,                  formula: null,            comment: '' },
              rate:   { val: null,                  formula: null,            comment: '' },
              amount: { val: null,                  formula: '=SUM(amount)',  comment: 'Auto-sum of all rows' },
              gst:    { val: null,                  formula: '=SUM(gst)',     comment: '' },
              total:  { val: null,                  formula: '=SUM(total)',   comment: '' },
              amt_cr: { val: null,                  formula: '=SUM(amt_cr)',  comment: '' },
              notes:  { val: '',                    formula: null,            comment: '' },
            }
          },
        ]
      }
    ]
  },

  mepCostplan: [
    { code: 'F',  label: 'MEPF/SERVICES WORK',                          init: 810000000,  r2: 996508764.58, r3: 959071854.05, r4: 938725727.58, r5: 937333708.80, internal: 815286851.27, consultant: 836960430.70, rmk: '',                                    level: 'H' },
    { code: '',   label: 'ELECTRICAL',                                   init: null,       r2: 445456007.91, r3: 411071702.23, r4: 433651713.44, r5: 433651713.44, internal: 380498751.67, consultant: 365665057.08, rmk: "Refer to 'MEP CONSUL' Sheet",         level: 'S' },
    { code: '',   label: 'PLUMBING',                                     init: null,       r2: 107870052.62, r3: 107870052.62, r4: 87904442.66,  r5: 81428641.84,  internal: 78773121,     consultant: 82131931,     rmk: '',                                    level: 'S' },
    { code: '',   label: 'FIREFIGHTING',                                 init: null,       r2: 145293316.37, r3: 142240711.52, r4: 127590013.74, r5: 127590013.74, internal: 114355395,    consultant: 120777456.29, rmk: '',                                    level: 'S' },
    { code: '',   label: 'HVAC',                                         init: null,       r2: 297889387.68, r3: 297889387.68, r4: 289579557.74, r5: 294663339.77, internal: 241659583.61, consultant: 268385986.33, rmk: '',                                    level: 'S' },
    { code: '—',  label: 'Tenant Scope (Retail, F&B deduction)',         init: null,       r2: -68860948.48, r3: -68860948.48, r4: -68860948.48, r5: -68860948.48, internal: null,         consultant: null,         rmk: '',                                    level: 'D' },
    { code: '',   label: 'Parking',                                      init: null,       r2: 299544002.66, r3: 282975847.64, r4: 251768537.74, r5: 233490548.33, internal: null,         consultant: null,         rmk: '',                                    level: 'H' },
    { code: '',   label: 'PARKING ELECTRICAL',                           init: null,       r2: 156681987.33, r3: 140113832.31, r4: 86017673.91,  r5: 86017673.91,  internal: null,         consultant: null,         rmk: 'LT CABLES cost not considered',       level: 'S' },
    { code: '',   label: 'PARKING PLUMBING',                             init: null,       r2: 21365090.09,  r3: 21365090.09,  r4: 24255303.26,  r5: 23255238.47,  internal: null,         consultant: null,         rmk: '',                                    level: 'S' },
    { code: '',   label: 'PARKING FIREFIGHTING',                         init: null,       r2: 36131244.16,  r3: 36131244.16,  r4: 39526134.23,  r5: 39526134.23,  internal: null,         consultant: null,         rmk: '',                                    level: 'S' },
    { code: '',   label: 'PARKING HVAC',                                 init: null,       r2: 85365681.07,  r3: 85365681.07,  r4: 101969426.34, r5: 84691501.72,  internal: null,         consultant: null,         rmk: '',                                    level: 'S' },
    { code: '',   label: 'Retail',                                       init: null,       r2: 73578471.55,  r3: 70666618.81,  r4: 69122151.37,  r5: 62839269.69,  internal: null,         consultant: null,         rmk: '',                                    level: 'H' },
    { code: '',   label: 'RETAIL ELECTRICAL',                            init: null,       r2: 16935756.62,  r3: 16104830.02,  r4: 9248874.22,   r5: 9248874.22,   internal: null,         consultant: null,         rmk: '',                                    level: 'S' },
    { code: '',   label: 'RETAIL PLUMBING',                              init: null,       r2: 2995909.13,   r3: 2995909.13,   r4: 2894872.59,   r5: 2894872.59,   internal: null,         consultant: null,         rmk: '',                                    level: 'S' },
    { code: '',   label: 'RETAIL FIREFIGHTING',                          init: null,       r2: 24763287.95,  r3: 22682361.80,  r4: 30538905.04,  r5: 30538905.04,  internal: null,         consultant: null,         rmk: '',                                    level: 'S' },
    { code: '',   label: 'RETAIL HVAC',                                  init: null,       r2: 28883517.85,  r3: 28883517.85,  r4: 26439499.51,  r5: 20156617.84,  internal: null,         consultant: null,         rmk: '',                                    level: 'S' },
    { code: '',   label: 'OFFICE',                                       init: null,       r2: 256465341.03, r3: 254634093.81, r4: 213017724.06, r5: 174915698.06, internal: null,         consultant: null,         rmk: '',                                    level: 'H' },
    { code: '',   label: 'OFFICE ELECTRICAL',                            init: null,       r2: 25975382.36,  r3: 25115813.83,  r4: 9034145.58,   r5: 9034145.58,   internal: null,         consultant: null,         rmk: '',                                    level: 'S' },
    { code: '',   label: 'OFFICE PLUMBING',                              init: null,       r2: 36851651.66,  r3: 36851651.66,  r4: 17352717.40,  r5: 14441049.46,  internal: null,         consultant: null,         rmk: '',                                    level: 'S' },
    { code: '',   label: 'OFFICE FIREFIGHTING',                          init: null,       r2: 68484861.20,  r3: 67513182.50,  r4: 46573459.16,  r5: 46573459.16,  internal: null,         consultant: null,         rmk: '',                                    level: 'S' },
    { code: '',   label: 'OFFICE HVAC',                                  init: null,       r2: 125153445.82, r3: 125153445.82, r4: 140057401.91, r5: 104867043.86, internal: null,         consultant: null,         rmk: '',                                    level: 'S' },
    { code: '',   label: 'MEP HIGH SIDE',                                init: null,       r2: 373779871.15, r3: 373779871.15, r4: 339263698.13, r5: 339263698.13, internal: null,         consultant: null,         rmk: '',                                    level: 'H' },
    { code: '',   label: 'HIGHSIDE ELECTRICAL',                          init: null,       r2: 210972757.75, r3: 210972757.75, r4: 216931008.13, r5: 216931008.13, internal: null,         consultant: null,         rmk: '',                                    level: 'S' },
    { code: '',   label: 'HIGHSIDE PLUMBING',                            init: null,       r2: 29981096.45,  r3: 29981096.45,  r4: 31240984.95,  r5: 31240984.95,  internal: null,         consultant: null,         rmk: '',                                    level: 'S' },
    { code: '',   label: 'HIGHSIDE FIRE',                                init: null,       r2: 11147805.91,  r3: 11147805.91,  r4: 7823246.85,   r5: 7823246.85,   internal: null,         consultant: null,         rmk: '',                                    level: 'S' },
    { code: '',   label: 'HIGHSIDE HVAC',                                init: null,       r2: 121678211.04, r3: 121678211.04, r4: 83268458.21,  r5: 83268458.21,  internal: null,         consultant: null,         rmk: '',                                    level: 'S' },
    { code: '',   label: 'ELECTRICAL HT OFFSITE',                        init: 0,          r2: 53000000,     r3: 53000000,     r4: 53000000,     r5: 53000000,     internal: null,         consultant: null,         rmk: '',                                    level: 'H' },
  ]
};

// Base-case snapshot — used by Reset button to restore original values
const _D_BASE = JSON.parse(JSON.stringify(D));

// Computed values — populated by recompute() in compute.js
let C = {};
