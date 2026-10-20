import React from 'react';
export function badgeInk(color?:string){const hex=/^#[0-9a-f]{6}$/i.test(color||'')?color!:'#f2d96f';const channels=[1,3,5].map(i=>{const n=parseInt(hex.slice(i,i+2),16)/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;});return .2126*channels[0]+.7152*channels[1]+.0722*channels[2]>.179?'#171b18':'#ffffff';}
export function ProBadge({color}:{color?:string}){return <span className="pro-badge" style={color?{backgroundColor:color,color:badgeInk(color)}:undefined}>PRO</span>;}
