import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {CharacterId} from '../types/game';
import {CHARACTERS} from '../game/rules/characters';
import {t} from '../i18n/translate';
import {useLanguage} from '../i18n/Language';
/** The caller supplies only an already-visible character. Face-down cards receive no identity. */
export function CardHelp({characterId}:{characterId?:CharacterId}){
 const [open,setOpen]=useState(false);const button=useRef<HTMLButtonElement>(null),close=useRef<HTMLButtonElement>(null);const {language}=useLanguage();
 useEffect(()=>{if(!open)return;close.current?.focus();const key=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false);if(event.key==='Tab'){event.preventDefault();close.current?.focus();}};window.addEventListener('keydown',key);return()=>{window.removeEventListener('keydown',key);button.current?.focus();};},[open]);
 const card=characterId?CHARACTERS[characterId]:null;
 const title=language==='ar'?'شرح البطاقة':'Card details';
 return <><button ref={button} type="button" className="card-help-button" aria-label={title+(card?' — '+t(card.nameAr):'')} onClick={event=>{event.stopPropagation();setOpen(true);}}>?</button>{open&&createPortal(<div className="modal-backdrop card-help-backdrop" onClick={()=>setOpen(false)}><section className="modal-card card-help-dialog" role="dialog" aria-modal="true" aria-label={title} onClick={event=>event.stopPropagation()} dir={language==='ar'?'rtl':'ltr'}><header className="modal-card__header"><h2>{title}</h2><button ref={close} type="button" className="btn-icon-close" onClick={()=>setOpen(false)} aria-label={t('إغلاق')}>✕</button></header><div className="modal-card__body">{card?<><img className="card-help-art" src={card.assetPath} alt=""/><h3 lang="ar" dir="rtl">{card.nameAr} — {card.badgeTextAr}</h3><p lang="ar" dir="rtl">{card.descriptionAr}</p><h3 lang="en" dir="ltr">{englishName(card.id)} — {englishAbility(card.id)}</h3><p lang="en" dir="ltr">{englishDescription(card.id)}</p></>:<><p lang="ar" dir="rtl">البطاقة مقلوبة وتبقى سرية. اضغط صادوه إذا شككت في الادعاء، أو تخطَّ التحدي.</p><p lang="en" dir="ltr">The face-down card stays secret. Call Sadooh! if you suspect a bluff, or pass.</p></>}</div></section></div>,document.body)}</>;
}
const details:Record<CharacterId,[string,string,string]>={malqoof:['Al-Malqoof','Secret Peek','Privately peek at one random card in a chosen player’s hand.'],nashal:['Al-Nashal','Steal Card','Take one random card from a chosen player’s hand.'],sanad:['Al-Sanad','Self Shield','Block the first ability targeting you until your next turn.'],mosarref:['Al-Mosarref','Extra Discard','Discard one extra card. You cannot win with the extra discard.'],mokhabbes:['Al-Mokhabbes','Shuffle Swap','Swap one of your cards with a random card from another player’s hand.'],alkabeer:['Al-Kabeer','Force Draw','Make a chosen player draw one card from the pile.']};
const englishName=(id:CharacterId)=>details[id][0];const englishAbility=(id:CharacterId)=>details[id][1];const englishDescription=(id:CharacterId)=>details[id][2];
