import { useEffect } from "react";

export function Analytics(){
 useEffect(()=>{
  if(!document.cookie.split("; ").some(v=>v.startsWith("vow_cookie_consent_v2=accepted"))) return;
  const id=import.meta.env['VITE_ANALYTICS_ID'] as string|undefined;
  if(!id||document.querySelector('script[data-vow-analytics]')) return;
  const s=document.createElement("script");s.async=true;s.src=`https://www.googletagmanager.com/gtag/js?id=${id}`;s.dataset['vowAnalytics']="true";document.head.appendChild(s);
  const w=window as typeof window & {dataLayer?:unknown[];gtag?:(...args:unknown[])=>void};w.dataLayer=w.dataLayer||[];w.gtag=(...args)=>w.dataLayer!.push(args);w.gtag("js",new Date());w.gtag("config",id,{anonymize_ip:true});
 },[]);
 return null;
}