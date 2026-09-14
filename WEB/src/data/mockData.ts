import { ReportItem } from '../types';

export const ASSETS = {
  operatorAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCHiO0Bs6ZfUtTNof6unWjxT6MC9ztJbixQxsLt4aKV9-j1r12v2Or7yn07BGlQ0nC97iwZtj6_am0e3Age6K9BmnBPho9sIJhHWHiFoEus85dJ_vQXleiZ9P7hDFLHWvrsKfKFmrmQr7LUOSs-Q0f-NTZWtDyQdpWkgYnQlgictv5bSsQHT1BltB35Thd0Y3KP62bVAdjW5k65L8nndOcHAQxsTMvl4CwRKz4GOBmZUIDLukFES5g',
  brandLogo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAWi3Xj8sNpLT7AnSskd7xic2Droare7JLqmt5uXHNgH0woqQBiOVTT7DQInMCvNXg2lA4_FYhCHUod544JdsqHdkpDyFkr0AFa0oAYi2ycFxwHI54nQTyu4vPZ4FItT0c3tChSfR9hnxo16kIilusbSv2_yBbQWozszmKeLrfVqnSVLZtiHp6wCk2WEXMEJtwxNHzyvaSfdUAZo2dO6vJJ7u0Q7w5Z41UFn3k_1Etrt9oPvIE58nY',
  operatorMobile: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC2_HKhh3CJqWPe0S0xGySESvIW0QoGUB_QXPCGtTR3oEm3OXdGbpy6NwWo_lFOO1h11LoGxcXM1Fzg5mrfa0zTt4QsiSRcIqNRyQX2t-uZo9UHjexdSfFGCikGcqSKrtylXpkU69_ccCCWa99FKxIsV--KV9SiE9tSRIQQ3ANa_mKBIUly_JdRtYdx5gE_wXL1DVnvRRg9yYEjjoqbobVW7yuqh0omHylgZ-121rxje-5gexdNP1Y',
  energyIcon: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAydcNXTKPLq2KsEaPzV10k1CoHNUJBIuJMUbB0VyoAjIfOs_mDX0sEgKIqZvH9MzJQ2_AcpBZN5I4DnDC5ZNUMNF0K_ZMFdWFHuwj39da-oXKyEazlbwgbeCetZwhiaqrw2htFa72aSVSS9H7FOyQxfizpNSfp1S46U9anI9OMN0HhdAf_mzsQlYiTEmK_-VjP9jUL-Iyq-ZovMSf6ab7AJQHNt2mQRM7zhuwNQqvRSGEZZCcYv5s',
  carbonIcon: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCYwB3XKBegaS9Cx_nXOhqZn9rKcIWthZzpPrZN7Hy5tttyHJHfO4XlxlbmyloaCNBTTHms05CV_qV0us-BltUyWUaIMlszK9715R0n07H-_gfS7ifw_Ml-p6ADO23aJ4SMLNoN-rIPQyVKzEYid2yVUcMKqQkQxZ3TShhQ2gjORT0GD6ZjtzLdN6wEofUkAz-A_ssPcv6lr1IR8NppB0Vdl97AST33iB4MIHp81lfRiNYdgnBfx_4',
  aiIcon: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBZ9GNWu9MN7COUTq3-RGLKwfQ83CyxUlr4H4qsp5QcCJDQZC-Fb0XhkMwN3RqD-clZUmSJtsjngSZlpZ-gkaMgp7OBaZKUGXCPhzhnwHo-yTJ81R8lH9Q8GrC61XQuddpgQcQgxQ9J9vu0-eLvzAD0ywWHxtz8SlVA0RCiYHTCfC3Oi9eog-Zuocwoa9Xa83_CYtsIPwI9ZbfDPmw3ozEPCOp6j7ZVDyvUtG8dCW779HAu-bl2heA'
};

/**
 * No seeded reports.
 *
 * Six worked examples lived here: a predictive maintenance log on centrifuge
 * vibration, a yield variance log against a theoretical yield, a fermentation
 * batch certification, and a compliance report quoting a CI score of
 * 52.4 gCO2e/MJ -- the exact lifecycle framing the Carbon screen removed as a
 * scope error. None of them could change, and the dashboard was contradicting
 * its own paperwork.
 *
 * Reports are now built from live figures when the operator generates one. See
 * sections/reports/reportTemplates.ts for the four this project supports.
 */
export const INITIAL_REPORTS: ReportItem[] = [];


// PLANT_ALARMS lived here: three invented alarms (a centrifuge bearing, a beer
// well sensor, a grid tariff window) that Overview and the bell popover both
// listed and that no reading could ever change. Alarms are now derived from the
// operator's own out-of-band readings in lib/plantAlarms.ts.

// AI_SETPOINTS lived here: two illustrative setpoints for levers this project
// does not model, with invented savings, confidences and safety boundaries. The
// cards that rendered them are gone. lib/distillationEngine.ts is the real
// optimiser on that screen.
