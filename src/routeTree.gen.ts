/* eslint-disable */
// @ts-nocheck
import { Route as rootRouteImport } from './routes/__root'
import { Route as IndexRouteImport } from './routes/index'
import { Route as HowItWorksRouteImport } from './routes/how-it-works'
import { Route as CopyrightRouteImport } from './routes/copyright'
import { Route as DeleteAccountRouteImport } from './routes/delete-account'
import { Route as PrivacyRouteImport } from './routes/privacy'
import { Route as PrivacyPolicyRouteImport } from './routes/privacy-policy'
import { Route as SupportRouteImport } from './routes/support'
import { Route as TermsRouteImport } from './routes/terms'
const IndexRoute=IndexRouteImport.update({id:'/',path:'/',getParentRoute:()=>rootRouteImport} as any)
const HowItWorksRoute=HowItWorksRouteImport.update({id:'/how-it-works',path:'/how-it-works',getParentRoute:()=>rootRouteImport} as any)
const CopyrightRoute=CopyrightRouteImport.update({id:'/copyright',path:'/copyright',getParentRoute:()=>rootRouteImport} as any)
const DeleteAccountRoute=DeleteAccountRouteImport.update({id:'/delete-account',path:'/delete-account',getParentRoute:()=>rootRouteImport} as any)
const PrivacyRoute=PrivacyRouteImport.update({id:'/privacy',path:'/privacy',getParentRoute:()=>rootRouteImport} as any)
const PrivacyPolicyRoute=PrivacyPolicyRouteImport.update({id:'/privacy-policy',path:'/privacy-policy',getParentRoute:()=>rootRouteImport} as any)
const SupportRoute=SupportRouteImport.update({id:'/support',path:'/support',getParentRoute:()=>rootRouteImport} as any)
const TermsRoute=TermsRouteImport.update({id:'/terms',path:'/terms',getParentRoute:()=>rootRouteImport} as any)
export interface FileRoutesByFullPath{'/':typeof IndexRoute;'/how-it-works':typeof HowItWorksRoute;'/copyright':typeof CopyrightRoute;'/delete-account':typeof DeleteAccountRoute;'/privacy':typeof PrivacyRoute;'/privacy-policy':typeof PrivacyPolicyRoute;'/support':typeof SupportRoute;'/terms':typeof TermsRoute}
export interface FileRoutesByTo extends FileRoutesByFullPath{}
export interface FileRoutesById{__root__:typeof rootRouteImport;'/':typeof IndexRoute;'/how-it-works':typeof HowItWorksRoute;'/copyright':typeof CopyrightRoute;'/delete-account':typeof DeleteAccountRoute;'/privacy':typeof PrivacyRoute;'/privacy-policy':typeof PrivacyPolicyRoute;'/support':typeof SupportRoute;'/terms':typeof TermsRoute}
export interface FileRouteTypes{fileRoutesByFullPath:FileRoutesByFullPath;fullPaths:'/ '|'/how-it-works'|'/copyright'|'/delete-account'|'/privacy'|'/privacy-policy'|'/support'|'/terms';fileRoutesByTo:FileRoutesByTo;to:'/'|'/how-it-works'|'/copyright'|'/delete-account'|'/privacy'|'/privacy-policy'|'/support'|'/terms';id:'__root__'|keyof FileRoutesByFullPath;fileRoutesById:FileRoutesById}
declare module '@tanstack/react-router'{interface FileRoutesByPath{'/':{id:'/';path:'/';fullPath:'/';preLoaderRoute:typeof IndexRouteImport;parentRoute:typeof rootRouteImport};'/how-it-works':{id:'/how-it-works';path:'/how-it-works';fullPath:'/how-it-works';preLoaderRoute:typeof HowItWorksRouteImport;parentRoute:typeof rootRouteImport};'/copyright':{id:'/copyright';path:'/copyright';fullPath:'/copyright';preLoaderRoute:typeof CopyrightRouteImport;parentRoute:typeof rootRouteImport};'/delete-account':{id:'/delete-account';path:'/delete-account';fullPath:'/delete-account';preLoaderRoute:typeof DeleteAccountRouteImport;parentRoute:typeof rootRouteImport};'/privacy':{id:'/privacy';path:'/privacy';fullPath:'/privacy';preLoaderRoute:typeof PrivacyRouteImport;parentRoute:typeof rootRouteImport};'/privacy-policy':{id:'/privacy-policy';path:'/privacy-policy';fullPath:'/privacy-policy';preLoaderRoute:typeof PrivacyPolicyRouteImport;parentRoute:typeof rootRouteImport};'/support':{id:'/support';path:'/support';fullPath:'/support';preLoaderRoute:typeof SupportRouteImport;parentRoute:typeof rootRouteImport};'/terms':{id:'/terms';path:'/terms';fullPath:'/terms';preLoaderRoute:typeof TermsRouteImport;parentRoute:typeof rootRouteImport}}}
const rootRouteChildren={IndexRoute,HowItWorksRoute,CopyrightRoute,DeleteAccountRoute,PrivacyRoute,PrivacyPolicyRoute,SupportRoute,TermsRoute}
export const routeTree=rootRouteImport._addFileChildren(rootRouteChildren)._addFileTypes<FileRouteTypes>()
import type { getRouter } from './router.tsx'
import type { startInstance } from './start.ts'
declare module '@tanstack/react-start'{interface Register{ssr:true;router:Awaited<ReturnType<typeof getRouter>>;config:Awaited<ReturnType<typeof startInstance.getOptions>>}}