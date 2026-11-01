import dictionary from './en.json';
export type Language='ar'|'en';
const english:Record<string,string>=dictionary;
const arabic=Object.fromEntries(Object.entries(english).filter(([key])=>!key.includes('{')).map(([key,value])=>[value,key]));
let language:Language='ar';
export function setLanguage(value:Language){language=value;}
export function getLanguage(){return language;}
const normalize=(s:string)=>s.replace(/\s+/g,' ').trim();
const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const templates=Object.entries(english).filter(([ar])=>/\{\d+\}/.test(ar)).map(([ar,en])=>{
 const order:number[]=[];let last=0,pattern='';for(const match of ar.matchAll(/\{(\d+)\}/g)){pattern+=escape(ar.slice(last,match.index));pattern+='(.+?)';order.push(Number(match[1]));last=match.index!+match[0].length;}pattern+=escape(ar.slice(last));return {re:new RegExp('^'+pattern+'$','u'),order,en,weight:ar.replace(/\{\d+\}/g,'').length};
}).sort((a,b)=>b.weight-a.weight);
export function fmt(source:string,args:unknown[]):string{
 const key=normalize(source),text=language==='en'?(english[key]||key):key;
 const formatted=text.replace(/\{(\d+)\}/g,(_,n)=>{const value=args[Number(n)];return typeof value==='string'?t(value):String(value??'');});
 return (/^\s/.test(source)?' ':'')+formatted+(/\s$/.test(source)?' ':'');
}
/** Translates presentation text only. Game state and server messages remain unchanged. */
export function t(source:string,depth=0):string{
 if(!source||depth>6)return source;
 if(language==='ar')return arabic[normalize(source)]||source;
 const key=normalize(source),direct=english[key];if(direct&&!/\{\d+\}/.test(key))return direct;
 for(const template of templates){const match=key.match(template.re);if(match){const args:string[]=[];template.order.forEach((n,i)=>args[n]=t(match[i+1],depth+1));return template.en.replace(/\{(\d+)\}/g,(_,n)=>args[Number(n)]||'');}}
 return source;
}
export function tr<T>(value:T):T {return (typeof value==='string'?t(value):value) as T;}
