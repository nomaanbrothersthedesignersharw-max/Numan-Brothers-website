/** Text-only, allowlisted content slots. No custom scripts/HTML or unverified links. */
export type SitePage = 'home'|'navigation'|'collections'|'product'|'search'|'contact'|'footer'|'policies'|'seo';
type FieldRow = [string,string,string,string?,boolean?];
export interface SiteField {key:string;label:string;fallback:string;section:string;multiline:boolean;}
const make=(rows:FieldRow[]):SiteField[]=>rows.map(([key,label,fallback,section='General',multiline=false])=>({key,label,fallback,section,multiline}));
export const SITE_PAGES: {id:SitePage;title:string;description:string}[]=[
 {id:'home',title:'Homepage',description:'Hero, editable cards and all landing sections'},
 {id:'navigation',title:'Navbar & announcement',description:'Brand, menu and search controls'},
 {id:'collections',title:'Collection pages',description:'Shared collection text; specific names and images are under Collections'},
 {id:'product',title:'Product pages',description:'Shared product labels and enquiry messages'},
 {id:'search',title:'Search page',description:'Search headings and empty results'},
 {id:'contact',title:'Visit & contact',description:'Showroom contact content'},
 {id:'footer',title:'Footer',description:'Business identity, social profiles and footer columns'},
  {id:'policies',title:'Store policies',description:'Owner-approved privacy, terms and return or exchange information'},
 {id:'seo',title:'Browser title & SEO',description:'Title suffix and public description'},
];
export const SITE_FIELDS:Record<SitePage,SiteField[]>={
 home:make([
  ['home.heroMen','Hero men’s button',"Explore men's wear",'Hero'],
  ['home.heroWhatsapp','Hero WhatsApp CTA','Enquire on WhatsApp','Hero'],
  ['home.heroPhone','Hero phone CTA','Call the showroom','Hero'],
  ['home.heroTailor','Hero tailoring link','Custom tailoring','Hero'],
  ['home.heroKids','Hero kids’ button','Kids collection','Hero'],
  ['home.scroll','Scroll prompt','Scroll to discover','Hero'],
  ['home.quickLabel','Quick menu heading','Explore quickly','Quick links'],
  ['home.quickSherwani','Quick Sherwani link','Sherwani','Quick links'],
  ['home.quickKurta','Quick Kurta link','Kurta Pyjama','Quick links'],
  ['home.quickWedding','Quick wedding link','Wedding Edit','Quick links'],
  ['home.quickKids','Quick kids link','Kids Wear','Quick links'],
  ['home.quickAll','Quick all-categories link','All categories','Quick links'],
  ['home.departmentEyebrow','Department eyebrow','Find your occasion','Department tiles'],
  ['home.departmentTitle','Department heading','Two worlds. One tradition.','Department tiles'],
  ['home.departmentDescription','Department description','Explore our clothing departments, organized for effortless discovery.','Department tiles',true],
  ['home.menCardEyebrow','Men’s tile label','Collection 01','Department tiles'],
  ['home.menCardTitle','Men’s tile title',"Men's Wear",'Department tiles'],
  ['home.menCardDescription','Men’s tile description','Sherwani · Kurta Pyjama · Suits · More','Department tiles'],
  ['home.kidsCardEyebrow','Kids’ tile label','Collection 02','Department tiles'],
  ['home.kidsCardTitle','Kids’ tile title','Kids Wear','Department tiles'],
  ['home.kidsCardDescription','Kids’ tile description','A special edit for every celebration','Department tiles'],
  ['home.directoryEyebrow','Directory eyebrow','The collection directory','Directory'],
  ['home.directoryTitle','Directory title','Find your look, beautifully.','Directory'],
  ['home.directoryDescription','Directory description','Every collection in one place. Choose a department, then go straight to the styles that interest you.','Directory',true],
  ['home.directorySearch','Directory search button','Search the catalogue','Directory'],
  ['home.directoryBottom','Directory footer text','Explore by style · Browse by department · Enquire at the showroom','Directory'],
  ['home.directoryContact','Directory contact link','Need guidance? Visit us','Directory'],
  ['home.directoryMen','Men’s directory summary','Sherwani · Kurta Pyjama · Suits · Marriage Collection','Directory'],
  ['home.directoryKids','Kids’ directory summary','Sherwani · Kurta Pyjama · Pathani · Little celebrations','Directory'],
  ['home.featureEyebrow','Featured eyebrow','The curated edit','Featured cards'],
  ['home.featureTitle','Featured title','Explore by style.','Featured cards'],
  ['home.featureCta','All collections button',"All men's collections",'Featured cards'],
  ['home.card1Eyebrow','Sherwani card eyebrow','01 / Groom collection','Featured cards'],
  ['home.card1Title','Sherwani card heading','The Sherwani Edit','Featured cards'],
  ['home.card1Text','Sherwani card description','Wedding silhouettes for the moment that matters.','Featured cards',true],
  ['home.card2Eyebrow','Kurta card eyebrow','02 / The classics','Featured cards'],
  ['home.card2Title','Kurta card heading','Kurta & Pyjama','Featured cards'],
  ['home.card2Text','Kurta card description','Timeless occasion-ready dressing.','Featured cards',true],
  ['home.card3Eyebrow','Jodhpuri card eyebrow','03 / Heritage fits','Featured cards'],
  ['home.card3Title','Jodhpuri card heading','Jodhpuri','Featured cards'],
  ['home.card3Text','Jodhpuri card description','Structured elegance for celebration.','Featured cards',true],
  ['home.storyEyebrow','Story eyebrow','An invitation to discover','Story'],
  ['home.storyCta','Story collection link','Marriage collection','Story'],
  ['home.visitEyebrow','Visit eyebrow','Experience the collection in person','Visit'],
  ['home.visitTitle','Visit heading','Come discover Nomaan Brothers.','Visit'],
  ['home.visitText','Visit description','Find our showroom in Mandi Bazar, Warangal. Explore styles, ask questions, and plan your visit.','Visit',true],
  ['home.visitCta','Visit link','Plan your visit','Visit'],
  ['home.customEyebrow','Tailoring eyebrow','Your occasion, your fabric','Customization'],
  ['home.customTitle','Customization section title','Made to fit your celebration.','Customization'],
  ['home.customText','Tailoring section description','Choose your fabric, share your measurements, and discuss your ideal sherwani with our tailoring team. We will guide you through fit, design and availability.','Customization',true],
  ['home.customStep1','First step','Choose a fabric','Customization'],
  ['home.customStep2','Second step','Tell us your measurements','Customization'],
  ['home.customStep3','Third step','Discuss your design','Customization'],
  ['home.customWhatsApp','Tailoring WhatsApp button','Discuss custom tailoring','Customization'],
  ['home.customCall','Tailoring call button','Call about tailoring','Customization'],
 ]),
 navigation:make([
  ['nav.announcement','Top announcement','Traditional occasionwear · Mandi Bazar, Warangal','Top bar'],
  ['nav.brand','Brand name','Nomaan Brothers','Identity'],
  ['nav.tagline','Brand tagline','The Designer Sherwani House','Identity'],
  ['nav.men','Men’s tab',"Men's Wear",'Menus'],
  ['nav.kids','Kids’ tab','Kids Wear','Menus'],
  ['nav.visit','Visit Us tab','Visit Us','Menus'],
  ['nav.visitCta','Showroom button','Visit showroom','Menus'],
  ['nav.discover','Dropdown eyebrow','Discover','Menus'],
  ['nav.viewAll','Dropdown all link','View all','Menus'],
  ['nav.mobileContact','Mobile contact button','Showroom & Contact','Menus'],
  ['nav.searchTitle','Search dialog title','Discover your style','Search'],
  ['nav.searchPlaceholder','Search placeholder','Sherwani, kurta, jodhpuri...','Search'],
  ['nav.searchHelp','Search description',"Search the preview catalogue, or explore Men's Wear and Kids Wear from the navigation.",'Search',true],
 ]),
 collections:make([
  ['collection.breadcrumb','Home breadcrumb','Home','Banner'],
  ['collection.eyebrow','Banner eyebrow','The Nomaan edit','Banner'],
  ['collection.explore','Related category heading','Explore','Related'],
  ['collection.heading','Product grid heading','The collection','Products'],
  ['collection.emptyEyebrow','Empty state label','Collection being curated','Empty'],
  ['collection.emptyTitle','Empty state heading','Something special is on its way.','Empty'],
  ['collection.emptyText','Empty state description','Photographs and confirmed products for this section will be added after the showroom catalogue is approved. Ask the store about current styles and availability.','Empty',true],
  ['collection.emptyCta','Contact button','Contact the showroom','Empty'],
  ['collection.cardCta','Product card label','View garment','Cards'],
 ]),
 product:make([
  ['product.brand','Product photo label','Nomaan Brothers / Atelier','Gallery'],
  ['product.videoTitle','Video heading','A closer look at the garment','Gallery'],
  ['product.videoCta','Video link','View product video','Gallery'],
  ['product.pricing','Availability message','For current prices, fitting options and availability, please contact the showroom.','Details',true],
  ['product.enquiry','Enquiry button','Enquire about this design','Details'],
  ['product.customTitle','Tailoring heading','Made to your measurements','Details'],
  ['product.customText','Tailoring description','This garment can be tailored with your preferred fabric and measurements. Contact our team to discuss details and availability.','Details',true],
  ['product.customCta','Tailoring enquiry button','Ask about customization','Details'],
  ['product.callCta','Phone button','Call the showroom','Details'],
  ['product.visit','Visit button','Visit our showroom','Details'],
  ['product.disclaimer','Disclaimer','Imagery and garment details will be confirmed by the showroom before public launch.','Details',true],
  ['product.nextEyebrow','More styles label','Continue your journey','More styles'],
  ['product.nextTitle','More styles heading','There is more to discover.','More styles'],
 ]),
 search:make([
  ['search.eyebrow','Search eyebrow','Discover the catalogue','Search'],
  ['search.title','Page title','Search collections','Search'],
  ['search.emptyTitle','Empty results heading','No matching styles yet.','Empty'],
  ['search.emptyText','Empty results description','Try searching for Sherwani, Kurta or Jodhpuri, or explore the departments.','Empty',true],
  ['search.browse','Browse men button',"Browse Men's Wear",'Empty'],
 ]),
 contact:make([
  ['contact.back','Return link','Back home','Header'],
  ['contact.eyebrow','Contact label','Visit the boutique','Header'],
  ['contact.title','Contact heading','Your next look starts here.','Header'],
  ['contact.description','Contact text',"Visit any of our three showrooms in Mandi Bazar, Warangal — two Nomaan Brothers showrooms and our newly launched Groom's Gallery. Ask about collections, sizes, and bespoke fittings before your visit.",'Header',true],
  ['contact.directions','Directions link','Find directions','Actions'],
  ['contact.call','Phone button','Call the showroom','Actions'],
  ['contact.whatsapp','WhatsApp link','WhatsApp enquiry','Actions'],
  ['contact.disclaimer','Disclaimer','Showroom address and contact details must be confirmed by the owner before public launch.','Actions',true],
 ]),
 footer:make([
  ['footer.brand','Footer brand','Nomaan Brothers','Identity'],
  ['footer.tagline','Footer tagline','The Designer Sherwani House','Identity'],
  ['footer.description','Footer description','Traditional occasionwear for men and kids, presented with a sense of heritage and celebration.','Identity',true],
  ['footer.men','Men’s heading',"Men's Wear",'Columns'],
  ['footer.kids','Kids heading','Kids Wear','Columns'],
  ['footer.find','Contact heading','Find Us','Columns'],
  ['footer.address','Store address',"3 Showrooms in Mandi Bazar, Warangal — Nomaan Brothers (2) & Groom's Gallery",'Contact'],
  ['footer.cta','Visit link','Visit / Enquire','Contact'],
  ['footer.copyright','Copyright suffix','All rights reserved.','Legal'],
  ['footer.slogan','Final slogan','Tradition in every occasion · Warangal','Legal'],
 ]),
 policies:make([
    ['policies.eyebrow','Policy page eyebrow','Customer information','Policy pages'],
    ['policies.pending','Unpublished policy message','Policy details are being confirmed with the showroom. Please contact us before placing an order or relying on any return, exchange or privacy terms.','Policy pages',true],
  ]),
 seo:make([
  ['seo.brand','Browser title suffix','Nomaan Brothers','Browser'],
  ['seo.description','Search description',"Explore men's and kids' traditional occasionwear at Nomaan Brothers, Mandi Bazar, Warangal. Browse collections and enquire about styles.",'Browser',true],
 ]),
};
const ALL_FIELDS=Object.values(SITE_FIELDS).flat();
const FIELD_MAP=new Map(ALL_FIELDS.map(field=>[field.key,field]));
export function siteText(home:{siteText?:Record<string,string>}|undefined,key:string):string{
  const value=home?.siteText?.[key];
  return typeof value==='string'?value:(FIELD_MAP.get(key)?.fallback??'');
}
export function cleanSiteText(value:unknown):Record<string,string>{
  if(!value||typeof value!=='object'||Array.isArray(value))return {};
  const copy=value as Record<string,unknown>;
  return Object.fromEntries(Object.entries(copy)
    .filter(([key,val])=>FIELD_MAP.has(key)&&typeof val==='string')
    .map(([key,val])=>[key,(val as string).slice(0,FIELD_MAP.get(key)?.multiline?900:240)]));
}
export const HOME_SECTIONS=[
 {id:'hero',title:'Hero',description:'Five-second cinematic video opener and editable main hero poster'},
 {id:'quick',title:'Quick links',description:'Short collection menu strip'},
 {id:'departments',title:'Men’s & Kids’ cards',description:'Two collection tiles'},
 {id:'directory',title:'Collection directory',description:'All the category links'},
 {id:'featured',title:'Featured styles',description:'Sherwani, kurta, Jodhpuri cards'},
 {id:'story',title:'Brand story',description:'Editorial photograph and story'},
 {id:'customization',title:'Custom tailoring',description:'Choose fabric, measurements and WhatsApp/call enquiries'},
 {id:'visit',title:'Visit showroom',description:'Directions call-to-action'},
] as const;
export const FEATURED_CARDS=[
 {id:'one',title:'Sherwani edit'},{id:'two',title:'Kurta edit'},{id:'three',title:'Jodhpuri edit'},
] as const;
export function normalizeOrder(value:unknown,allowed:readonly string[]):string[]{
  const unique=Array.isArray(value)?[...new Set(value.filter((x):x is string=>typeof x==='string'))]:[];
  const chosen=unique.filter(x=>allowed.includes(x));
  return [...chosen,...allowed.filter(x=>!chosen.includes(x))];
}
export function homeSectionStyle(home:{sectionOrder?:string[];hiddenSections?:string[]},id:string){
  return {order:normalizeOrder(home.sectionOrder,HOME_SECTIONS.map(s=>s.id)).indexOf(id),
    display:home.hiddenSections?.includes(id)&&id!=='hero'?'none':undefined};
}
export function featuredCardStyle(home:{featuredOrder?:string[]},id:string){
  return {order:normalizeOrder(home.featuredOrder,FEATURED_CARDS.map(s=>s.id)).indexOf(id)};
}
