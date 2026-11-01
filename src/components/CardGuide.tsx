import {t,fmt,tr} from '../i18n/translate';
import React from 'react';
import {CHARACTER_LIST} from '../game/rules/characters';
const simple:Record<string,string>={malqoof:'شوف بطاقة من يد خصمك، لحالك.',nashal:'خذ بطاقة من يد خصمك.',sanad:'درع يحميك من أول قدرة ضدك.',mosarref:'تخلّص من بطاقة إضافية.',mokhabbes:'بدّل بطاقة مع خصمك.',alkabeer:'خلّ خصمك يسحب بطاقة.'};
export const CardGuide:React.FC=()=> <section className="card-guide" aria-label={t("جميع البطاقات وقدراتها")}><h3>{""+t("تعرّف على البطاقات")+""}</h3><p>{""+t("ما تحتاج تحفظها. وصف كل بطاقة موجود عليها.")+""}</p><div className="card-guide-grid">{tr(CHARACTER_LIST.map(c=><article className="card-guide-item" key={c.id}><img src={c.assetPath} alt={tr(fmt("شخصية {0}",[c.nameAr]))}/><div><h4>{tr(c.nameAr)}</h4><p>{tr(simple[c.id])}</p></div></article>))}</div></section>;
