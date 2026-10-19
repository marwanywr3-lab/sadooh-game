export const BOT_NAMES = ['عبد الله','احمد','خالد','محمد','عبد العزيز','فهد','سعيد','عبد الحميد','خالد','سالم','اصيل','مبارك','ابراهيم','صالح','ماجد'];
export function pickBotNames(count:number,rng:()=>number=Math.random,excluded:string[]=[]):string[]{
 const pool=[...new Set(BOT_NAMES)].filter(n=>!excluded.includes(n));
 for(let i=pool.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
 return pool.slice(0,count);
}
