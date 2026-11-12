/**
 * Browser smoke suite for the public shop and (unauthenticated) private Studio.
 * Uses a separately installed pinned Playwright package via NODE_PATH so the
 * application's frozen Bun dependency lockfile remains untouched.
 */
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');

const base=(process.env.NB_TEST_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const live=process.env.NB_MODE==='live';
const screenshots='artifacts/browser';
mkdirSync(screenshots,{recursive:true});

const mockProduct={
  id:'11111111-1111-4111-8111-111111111111',slug:'ivory-sherwani-nb-sh-00001',
  sku:'NB-SH-00001',title:'Ivory Heritage Sherwani',department:'men',
  category_paths:['/men/sherwani'],description:'An elegant sherwani for celebrations.',
  fabric:'Silk blend',sizes:['40','42','44'],image_urls:[],video_url:null,
  price:12000,offer_price:9900,customizable:true,status:'published',sort_rank:1,
  created_at:'2026-10-01T00:00:00Z',updated_at:'2026-10-01T00:00:00Z'
};
async function mockCmsRoutes(page,{emptyContacts=false,heroVideo=false,configuredSocial=false}={}){
  if(process.env.NB_MOCK_CMS!=='1')return;

  // Public storefront reads now use same-origin Vercel API routes. Keep the
  // browser fixture aligned with that contract so responsive tests exercise
  // real page states instead of the empty fallback used when APIs are absent
  // from the local Vite dev server.
  const homepage=emptyContacts?{}:{
    contactWhatsapp:'919876543210',contactPhone:'919876543211',
    sectionVideos:heroVideo?{hero:'https://fixture.supabase.co/intro-film.mp4'}:{},
    socialLinks:configuredSocial?{
      instagram:'https://www.instagram.com/nomaanbrothers/',
      facebook:'https://instagram.com/pretending-to-be-facebook',
    }:{},
  };
  await page.route('**/api/storefront',async route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({products:[mockProduct],homepage,categories:[]}),
  }));
  await page.route('**/api/catalogue**',async route=>{
    const url=new URL(route.request().url());
    const params=url.searchParams;
    const handle=params.get('product');
    if(handle!==null){
      const product=handle===mockProduct.id||handle===mockProduct.slug||handle===mockProduct.sku
        ? mockProduct : null;
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({product})});
    }
    if(params.has('related')){
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({products:[]})});
    }
    const pageNumber=Number(params.get('page')||'0');
    const routePath=params.get('route')||'';
    const query=(params.get('q')||'').toLowerCase();
    const isMenDepartment=routePath==='/men';
    const isMatchingSherwani=!routePath||isMenDepartment||routePath==='/men/sherwani';
    const matchesQuery=!query||mockProduct.title.toLowerCase().includes(query)||mockProduct.sku.toLowerCase().includes(query);
    const products=pageNumber===0&&!routePath.startsWith('/kids')&&isMatchingSherwani&&matchesQuery
      ? [mockProduct] : [];
    return route.fulfill({
      status:200,contentType:'application/json',
      body:JSON.stringify({products,page:pageNumber,pageSize:24,hasMore:false}),
    });
  });

  await page.route('https://fixture.supabase.co/**',async route=>{
    const url=new URL(route.request().url());
    const path=url.pathname;
    const json=(body,extra={})=>route.fulfill({status:200,contentType:'application/json',
      headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey,authorization,content-type,x-client-info,prefer,accept,accept-profile,content-profile','Access-Control-Allow-Methods':'GET,POST,OPTIONS,HEAD','content-range':'0-0/1',...extra},body:JSON.stringify(body)});
    if(path.endsWith('/intro-film.mp4'))
      return route.fulfill({status:404,contentType:'text/plain',body:'Fixture deliberately has no film bytes'});
    if(path.endsWith('/nb_home_public'))return json({content:emptyContacts?{}:{
      contactWhatsapp:'919876543210',contactPhone:'919876543211',
      sectionVideos:heroVideo?{hero:'https://fixture.supabase.co/intro-film.mp4'}:{},
      socialLinks:configuredSocial?{
        instagram:'https://www.instagram.com/nomaanbrothers/',
        facebook:'https://instagram.com/pretending-to-be-facebook',
      }:{},
    }});
    if(path.endsWith('/nb_categories'))return json([]);
    if(path.endsWith('/nb_products')){
      const singleton=(route.request().headers()['accept']||'').includes('vnd.pgrst.object');
      if(singleton){
        const match=url.searchParams.get('slug')==='eq.'+mockProduct.slug ||
          url.searchParams.get('id')==='eq.'+mockProduct.id;
        return match?json(mockProduct):route.fulfill({status:406,contentType:'application/json',body:JSON.stringify({code:'PGRST116'})});
      }
      if(url.searchParams.get('id')==='neq.'+mockProduct.id)return json([],{'content-range':'*/0'});
      const dept=url.searchParams.get('department');
      const hasKids=dept==='eq.kids'||(url.searchParams.get('category_paths')||'').includes('/kids/');
      const search=url.searchParams.get('or')||'';
      const rows=hasKids||(search&&!search.toLowerCase().includes('sherwani'))?[]:[mockProduct];
      return json(rows,{'content-range':rows.length?'0-0/1':'*/0'});
    }
    return json([]);
  });
}

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const failures=[];
const results=[];
let skipped=false;

async function inspect(route,width=390,height=844,opts={}){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:opts.reduce?'reduce':'no-preference'});
  const page=await context.newPage();
  page.setDefaultTimeout(8000);
  const runtimeErrors=[];
  page.on('pageerror',error=>runtimeErrors.push(String(error.message)));
  await mockCmsRoutes(page);
  try{
    const response=await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:live?20000:12000});
    const status=response?.status()||0;
    if(live && [401,403,429].includes(status)){
      skipped=true;console.log('DEPLOYMENT_ACCESS_LIMITED',base,route,status);return;
    }
    assert.equal(status,200,'HTTP '+status+' at '+route);
    await page.locator('h1').first().waitFor({state:'visible',timeout:live?20000:8000});
    await page.waitForTimeout(150);
    const layout=await page.evaluate(()=>{
      const heading=document.querySelector('h1');
      const rect=heading?.getBoundingClientRect();
      const nav=Array.from(document.querySelectorAll('header button[aria-label="Open navigation"],header button[aria-label="Search collections"]'))
        .filter(el=>el.getClientRects().length>0)
        .map(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,height:r.height}});
      return {
        screen:innerWidth,
        documentWidth:document.documentElement.scrollWidth,
        bodyWidth:document.body.scrollWidth,
        h1:heading?.textContent?.trim()||'',
        h1Bounds:rect?{left:rect.left,right:rect.right}:null,
        nav,
      };
    });
    assert.ok(layout.documentWidth<=width+2,
      'horizontal page overflow at '+route+' '+width+'px: '+layout.documentWidth);
    assert.ok(layout.bodyWidth<=width+2,
      'body overflow at '+route+' '+width+'px: '+layout.bodyWidth);
    assert.deepEqual(runtimeErrors,[],'page JavaScript errors on '+route+' '+width+'px');
    // Live deployments may still serve the previous release during rollout.
    // Enforce the new icon count on the candidate build, not stale production.
    if(!live && route==='/'&&width===390){
      const nav=page.locator('footer').getByRole('navigation',{name:'Nomaan Brothers social media channels'});
      await nav.waitFor({state:'attached',timeout:5000});
      assert.equal(await nav.locator('img').count(),1,
        'exactly one local Instagram icon must be present on the footer');
      const src=await nav.locator('img').evaluateAll(els=>els.map(img=>img.getAttribute('src')));
      assert.ok(src.every(x=>/^\/social\/[a-z-]+\.svg$/.test(x)),
        'icons must be local SVG assets, not external CDNs');
      if(!live)assert.equal(await nav.locator('a').count(),0,
        'unconfigured social accounts must not become fake or broken links');
    }
    assert.ok(layout.h1Bounds&&layout.h1Bounds.left>=-2&&layout.h1Bounds.right<=width+2,
      'main heading clipped on '+route+' '+width+'px');
    for(const target of layout.nav) {
      assert.ok(target.left>=-2&&target.right<=width+2,'header control outside viewport '+route+' '+width+'px');
      assert.ok(target.width>=40&&target.height>=40,'header control below usable touch size');
    }
    if(opts.matrix&&route==='/studio'&&width<=820){
      const authInput=page.getByRole('textbox',{name:'Staff email'});
      if(await authInput.count())assert.ok(await authInput.isVisible(),'Studio login must fit');
    }
    if(route==='/'){
      const hero=page.locator('#v2-home-title');
      assert.equal(await hero.count(),1,'one semantic hero heading');
      assert.ok((await hero.getAttribute('class'))?.includes('nb-liquid-hero'));
      const menu=page.locator('nav[aria-label="Explore popular collections"]');
      for(const route of ['/men/sherwani','/men/kurta-pyjama','/men/marriage','/kids'])
        assert.equal(await menu.locator('a[href="'+route+'"]').count(),1,'quick link '+route);
      const effect=await hero.evaluate(el=>{
        const style=getComputedStyle(el);
        return {animation:style.animationName,gradient:style.backgroundImage};
      });
      if(opts.reduce)assert.equal(effect.animation,'none','reduced motion must disable shimmer');
      else assert.match(effect.gradient,/gradient/,'water reflection has CSS gradient');
      const opening=page.getByTestId('brand-intro');
      if(await opening.count()){
        await page.getByRole('button',{name:'Skip brand introduction'}).click();
        await opening.waitFor({state:'hidden',timeout:4000});
      }
      if(opts.matrix&&[280,375,820,1280].includes(width)){
        await page.getByRole('button',{name:'Search collections'}).click();
        await page.getByRole('dialog',{name:'Search clothing collections'}).waitFor({state:'visible',timeout:5000});
        await page.keyboard.press('Escape');
        await page.getByRole('dialog',{name:'Search clothing collections'}).waitFor({state:'hidden',timeout:5000});
      }
      if(opts.matrix&&route==='/'&&[1024,1180,1280].includes(width)){
        const departmentToggle=page.locator('header button[aria-controls="department-men"]');
        await departmentToggle.click();
        const panel=page.locator('#department-men');
        await panel.waitFor({state:'visible',timeout:5000});
        const menuBounds=await panel.evaluate(el=>{
          const r=el.getBoundingClientRect();
          return {left:r.left,right:r.right,width:r.width,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth};
        });
        assert.ok(menuBounds.left>=-2&&menuBounds.right<=width+2,
          'desktop department menu must stay inside viewport at '+width+'px');
        assert.ok(menuBounds.scrollWidth<=menuBounds.clientWidth+2,
          'desktop department menu must not overflow internally at '+width+'px');
        await page.keyboard.press('Escape');
        await panel.waitFor({state:'hidden',timeout:5000});
      }
      if(width<=768 && !opts.reduce){
        await page.getByRole('button',{name:'Open navigation'}).click();
        await page.getByRole('dialog',{name:'Browse collections'}).waitFor({state:'visible',timeout:5000});
        await page.keyboard.press('Escape');
        await page.getByRole('dialog',{name:'Browse collections'}).waitFor({state:'hidden',timeout:5000});
      }
    }
    if(route==='/'&&live&&width===390){
      await page.locator('[data-nb-contact-hero]')
        .evaluate(el=>window.scrollTo(0,el.getBoundingClientRect().bottom+window.scrollY+160));
      const dock=page.getByTestId('floating-contact-dock');
      await dock.waitFor({state:'visible',timeout:8000});
      const contactLinks=await dock.locator('a').evaluateAll(links=>links.map(link=>link.getAttribute('href')||''));
      assert.ok(contactLinks.some(href=>href==='/contact'||href.startsWith('tel:+')||href.startsWith('https://wa.me/')),
        'production must expose a working showroom, phone or WhatsApp action without inventing contact details');
      console.log('PASS_LIVE_CONTACT_DOCK',JSON.stringify({base,width,links:contactLinks}));
    }
    if(!opts.reduce && (!opts.matrix || [280,390,768,1024,1920].includes(width)) && (route==='/' || route==='/studio' || (width===390 && route==='/men/sherwani'))){
      const name=(live?'live-':'local-')+route.replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').replace(/^$/,'home')+'-'+width+'.png';
      await page.screenshot({path:join(screenshots,name),animations:'disabled'});
    }
    const metric={url:base+route,width,status,documentWidth:layout.documentWidth,h1:layout.h1.slice(0,72)};
    results.push(metric);console.log('PASS',JSON.stringify(metric));
  }catch(error){
    failures.push({route,width,error:String(error?.stack||error)});
    console.error('FAIL',base+route,width,String(error?.message||error));
  }finally{await context.close();}
}


async function inspectUnconfiguredContactFallback(){
  if(process.env.NB_MOCK_CMS!=='1')return;
  for(const width of [320,375,390,768,1440]){
    const context=await browser.newContext({viewport:{width,height:844}});
    const page=await context.newPage();
  page.setDefaultTimeout(8000);
    await mockCmsRoutes(page,{emptyContacts:true});
    try{
      await page.goto(base+'/',{waitUntil:'domcontentloaded'});
      await page.locator('#v2-home-title').waitFor({state:'visible',timeout:7000});
      const dock=page.getByTestId('floating-contact-dock');
      assert.equal(await dock.count(),0,'dock is hidden before hero is passed');
      await page.locator('[data-nb-contact-hero]')
        .evaluate(el=>window.scrollTo(0,el.getBoundingClientRect().bottom+window.scrollY+160));
      await dock.waitFor({state:'visible',timeout:7000});
      const fallback=dock.getByRole('link',{name:'Contact Nomaan Brothers showroom'});
      assert.equal(await fallback.getAttribute('href'),'/contact');
      assert.equal(await dock.locator('a[href^="https://wa.me/"]').count(),0,'no invented WhatsApp number');
      assert.equal(await dock.locator('a[href^="tel:"]').count(),0,'no invented phone number');
      const rect=await fallback.boundingBox();
      assert.ok(rect&&rect.width>=44&&rect.height>=44,'fallback is easy to tap');
      const extent=await page.evaluate(()=>document.documentElement.scrollWidth);
      assert.ok(extent<=width+2,'no horizontal overflow at '+width+'px');
      console.log('PASS_EMPTY_CONTACT_FALLBACK',JSON.stringify({width,href:'/contact',tapHeight:rect.height}));
    }catch(error){
      failures.push({route:'empty-contact',width,error:String(error?.stack||error)});
      console.error('FAIL_EMPTY_CONTACT_FALLBACK',width,String(error?.message||error));
    }finally{await context.close();}
  }
}

async function inspectFloatingContactsAndProduct(){
  if(process.env.NB_MOCK_CMS!=='1')return;
  const context=await browser.newContext({viewport:{width:375,height:812}});
  const page=await context.newPage();
  page.setDefaultTimeout(8000);
  await mockCmsRoutes(page);
  try{
    await page.goto(base+'/',{waitUntil:'domcontentloaded'});
    await page.locator('#v2-home-title').waitFor({state:'visible'});
    const dock=page.getByTestId('floating-contact-dock');
    assert.equal(await dock.count(),0,'contact dock starts hidden above the hero');
    await page.locator('[data-nb-contact-hero]').evaluate(el=>window.scrollTo(0,el.getBoundingClientRect().bottom+window.scrollY+160));
    await dock.waitFor({state:'visible',timeout:7000});
    const whatsapp=dock.getByRole('link',{name:/WhatsApp/});
    const call=dock.getByRole('link',{name:/Call Nomaan Brothers/});
    assert.match(await whatsapp.getAttribute('href'),/^https:\/\/wa\.me\/919876543210\?text=/);
    assert.equal(await call.getAttribute('href'),'tel:+919876543211');
    const target=await call.boundingBox();
    assert.ok(target?.height>=44&&target?.width>=44,'touch target must be 44px minimum');
    console.log('PASS_FLOATING_CONTACT_DOCK',JSON.stringify({width:375,hiddenAboveHero:true,links:2,touchTarget:target?.height}));
    await page.goto(base+'/products/'+mockProduct.slug,{waitUntil:'domcontentloaded'});
    await page.getByRole('heading',{level:1,name:mockProduct.title}).waitFor({state:'visible',timeout:7000});
    assert.equal(await page.getByText('Style code · '+mockProduct.sku).count(),1);
    const size=page.getByRole('button',{name:'42',exact:true});
    await size.click();
    assert.equal(await size.getAttribute('aria-pressed'),'true');
    const enquire=page.getByRole('link',{name:/Enquire about this design/i}).first();
    assert.match(await enquire.getAttribute('href'),/Requested%20size%3A%2042/);
    await page.getByRole('button',{name:/Share this design/}).click();
    await page.getByRole('status').filter({hasText:/Link copied|browser address|Shared successfully/})
      .first().waitFor({state:'visible',timeout:5000});
    const gridLinks=await page.locator('a[href="/products/'+mockProduct.slug+'"]').count();
    assert.equal(gridLinks,0,'current item must not appear as a related product');
    console.log('PASS_UNIQUE_PRODUCT_PAGE',JSON.stringify({slug:mockProduct.slug,size:'42',share:true,wa:true}));
  }catch(error){
    failures.push({route:'floating-and-product',width:375,error:String(error?.stack||error)});
    console.error('FAIL_FLOATING_CONTACT_PRODUCT',String(error?.message||error));
  }finally{await context.close();}
}


async function inspectConfiguredSocialIcons(){
  if(live||process.env.NB_MOCK_CMS!=='1')return;
  const widths=[280,320,344,360,375,390,414,430,480,640,768,820,1024,1180,1280,1440,1920,2560];
  for(const width of widths){
    const context=await browser.newContext({viewport:{width,height:850}});
    const page=await context.newPage();
    page.setDefaultTimeout(8000);
    await mockCmsRoutes(page,{configuredSocial:true});
    try{
      await page.goto(base+'/contact',{waitUntil:'domcontentloaded'});
      const footer=page.locator('footer [data-testid="social-profile-icons"]');
      const contact=page.locator('main [data-testid="social-profile-icons"]');
      await footer.waitFor({state:'attached',timeout:8000});
      const footerInstagram=footer.getByTestId('social-instagram-link');
      const contactInstagram=contact.getByTestId('social-instagram-link');
      // The footer renders the empty CMS template before the approved
      // homepage fetch resolves. Wait for hydration instead of racing it.
      await footerInstagram.waitFor({state:'attached',timeout:7000});
      await contactInstagram.waitFor({state:'attached',timeout:7000});
      assert.equal(await footer.locator('img').count(),1,'only Instagram icon visible in the footer');
      assert.equal(await footer.locator('a').count(),1,'only official-domain account links in the footer');
      assert.equal(await contact.locator('a').count(),1,'contact page shows the same verified profile link');
      assert.equal(await footerInstagram.getAttribute('href'),'https://www.instagram.com/nomaanbrothers/');
      assert.equal(await contactInstagram.getAttribute('href'),'https://www.instagram.com/nomaanbrothers/');
      assert.equal(await footer.getByRole('img',{name:'Facebook profile not connected yet'}).count(),0);
      for(const [region,link,description] of [
        [footer,footerInstagram,'footer'],
        [contact,contactInstagram,'contact section'],
      ]){
        await link.scrollIntoViewIfNeeded();
        await link.locator('img').evaluate(image=>image.decode());
        const geometry=await region.evaluate(nav=>{
          const link=nav.querySelector('[data-testid="social-instagram-link"]');
          const image=link?.querySelector('img');
          const parent=nav.parentElement;
          const box=el=>{
            const r=el.getBoundingClientRect();
            return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};
          };
          return {
            nav:box(nav),link:link?box(link):null,image:image?box(image):null,
            parent:parent?box(parent):null,
            documentWidth:document.documentElement.scrollWidth,
            imageLoaded:!!image&&image.complete&&image.naturalWidth>0,
            navScrollWidth:nav.scrollWidth,navClientWidth:nav.clientWidth,
          };
        });
        assert.ok(geometry.link,'Instagram link exists in '+description);
        assert.ok(geometry.link.width>=44&&geometry.link.height>=44,
          description+' Instagram tap target must be at least 44×44px at '+width+'px');
        assert.ok(geometry.link.left>=-1&&geometry.link.right<=width+1,
          description+' Instagram control must stay inside the viewport at '+width+'px');
        assert.ok(geometry.image&&geometry.image.width>=22&&geometry.image.height>=22,
          description+' Instagram glyph must scale above 22px at '+width+'px');
        assert.ok(geometry.image.width<=32&&geometry.image.height<=32,
          description+' Instagram glyph must stay proportionate at '+width+'px');
        assert.ok(geometry.image.left>=geometry.link.left&&geometry.image.right<=geometry.link.right,
          description+' Instagram glyph must stay inside its circular control');
        assert.ok(geometry.image.top>=geometry.link.top&&geometry.image.bottom<=geometry.link.bottom,
          description+' Instagram glyph must stay vertically contained');
        assert.ok(geometry.nav.width<=geometry.parent.width+2,
          description+' social navigation must fit its content column');
        assert.ok(geometry.navScrollWidth<=geometry.navClientWidth+2,
          description+' social navigation must not overflow internally');
        assert.ok(geometry.documentWidth<=width+2,
          description+' icon must not create horizontal page scrolling');
        assert.equal(geometry.imageLoaded,true,'local Instagram SVG must load successfully');
        assert.equal(await link.getAttribute('target'),'_blank');
        assert.match(await link.getAttribute('rel')||'',/noopener/);
      }
      console.log('PASS_SOCIAL_RESPONSIVE',JSON.stringify({width,regions:2,iconPx:width<640?24:28,tapTargetPx:width<640?48:56}));
    }catch(error){
      failures.push({route:'social-responsive',width,error:String(error?.stack||error)});
      console.error('FAIL_SOCIAL_RESPONSIVE',width,String(error?.message||error));
    }finally{await context.close();}
  }
}

async function inspectUnconfiguredSocialIcons(){
  if(live||process.env.NB_MOCK_CMS!=='1')return;
  for(const width of [280,320,390,768,1440]){
    const context=await browser.newContext({viewport:{width,height:850}});
    const page=await context.newPage();
    page.setDefaultTimeout(8000);
    await mockCmsRoutes(page);
    try{
      await page.goto(base+'/contact',{waitUntil:'domcontentloaded'});
      const footer=page.locator('footer [data-testid="social-profile-icons"]');
      await footer.waitFor({state:'attached',timeout:8000});
      const placeholder=footer.getByTestId('social-instagram-pending');
      await placeholder.waitFor({state:'attached',timeout:7000});
      const rect=await placeholder.boundingBox();
      assert.ok(rect&&rect.width>=44&&rect.height>=44,'pending Instagram state keeps a usable touch-sized visual at '+width+'px');
      assert.ok(rect.x>=-1&&rect.x+rect.width<=width+1,'pending Instagram state remains on-screen at '+width+'px');
      assert.equal(await footer.locator('a').count(),0,'unconfigured Instagram must not create a dead link');
      assert.ok((await page.evaluate(()=>document.documentElement.scrollWidth))<=width+2,
        'pending Instagram state must not widen the document');
      console.log('PASS_SOCIAL_PENDING_RESPONSIVE',JSON.stringify({width,tapTargetPx:rect.width}));
    }catch(error){
      failures.push({route:'social-pending-responsive',width,error:String(error?.stack||error)});
      console.error('FAIL_SOCIAL_PENDING_RESPONSIVE',width,String(error?.message||error));
    }finally{await context.close();}
  }
}

async function inspectCinematicHeroIntro(){
  if(live||process.env.NB_MOCK_CMS!=='1')return;
  for(const [width,height,heroVideo] of [[320,650,false],[390,844,true],[1440,900,true]]){
    const context=await browser.newContext({viewport:{width,height},reducedMotion:'no-preference'});
    const page=await context.newPage();
  page.setDefaultTimeout(8000);
    await mockCmsRoutes(page,{heroVideo});
    try{
      await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:15000});
      const intro=page.getByTestId('brand-intro');
      await intro.waitFor({state:'visible',timeout:6000});
      assert.equal(await intro.getAttribute('data-phase'),'playing');
      assert.notEqual(await page.getByTestId('main-hero').getAttribute('inert'),null,
        'main hero is inert while intro overlays it');
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth);
      assert.ok(overflow<=width+2,'cinematic video intro causes horizontal overflow at '+width+'px');
      assert.equal(await page.getByRole('button',{name:'Skip brand introduction'}).count(),1);
      if(width===320){
        await page.getByRole('button',{name:'Skip brand introduction'}).click();
        await intro.waitFor({state:'hidden',timeout:3500});
      }else if(width===390){
        // Intentionally broken fixture video: the animated poster and skip still work.
        await page.getByRole('button',{name:'Skip brand introduction'}).click();
        await intro.waitFor({state:'hidden',timeout:3500});
        await page.getByRole('button',{name:'Replay brand film'}).click();
        await intro.waitFor({state:'visible',timeout:3500});
        await page.keyboard.press('Escape');
        await intro.waitFor({state:'hidden',timeout:3500});
      }else{
        await page.waitForTimeout(4000);
        assert.equal(await intro.getAttribute('data-phase'),'playing',
          'intro must stay onscreen until five seconds');
        await page.waitForTimeout(1150);
        const phase=await intro.getAttribute('data-phase');
        assert.ok(phase==='leaving'||phase==='finished','intro moves left around 5s');
        await intro.waitFor({state:'hidden',timeout:3000});
      }
      assert.equal(await page.getByTestId('main-hero').getAttribute('inert'),null,
        'main hero becomes interactive after the intro');
      await page.screenshot({path:join(screenshots,'cinematic-hero-'+width+'.png'),
        animations:'disabled'});
      console.log('PASS_CINEMATIC_HERO',JSON.stringify({width,heroVideo,skip:width!==1440,
        videoErrorFallback:width===390,fiveSecondExit:width===1440}));
    }catch(error){
      failures.push({route:'cinematic-hero',width,error:String(error?.stack||error)});
      console.error('FAIL_CINEMATIC_HERO',width,String(error?.message||error));
    }finally{await context.close();}
  }
  for(const reduce of [true,false]){
    const context=await browser.newContext({viewport:{width:375,height:812},
      reducedMotion:reduce?'reduce':'no-preference'});
    const page=await context.newPage();
  page.setDefaultTimeout(8000);
    if(!reduce)await page.addInitScript(()=>{
      Object.defineProperty(navigator,'connection',{configurable:true,value:{saveData:true}});
    });
    await mockCmsRoutes(page,{heroVideo:true});
    try{
      await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:15000});
      await page.getByTestId('brand-intro').waitFor({state:'hidden',timeout:4500});
      assert.equal(await page.getByTestId('main-hero').getAttribute('inert'),null,
        'reduced motion / data saver skips animated intro');
      console.log('PASS_CINEMATIC_ACCESSIBILITY',JSON.stringify({reducedMotion:reduce,
        dataSaver:!reduce}));
    }catch(error){
      failures.push({route:'intro-accessibility',width:375,error:String(error?.stack||error)});
      console.error('FAIL_CINEMATIC_ACCESSIBILITY',String(error?.message||error));
    }finally{await context.close();}
  }
}

async function inspectEditorialRoutes(){
  // PR workflow tests new features locally, not against the still-live main release.
  if(live||process.env.NB_MOCK_CMS!=='1')return;
  const routes=['/products/sample-plain-sherwani','/men/sherwani/plain',
    '/privacy-policy','/terms-and-conditions','/returns-and-exchanges'];
  for(const route of routes)for(const [width,height] of [[320,720],[390,844],[820,1180],[1440,900]]){
    await inspect(route,width,height,{matrix:true});
  }
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage();
  page.setDefaultTimeout(8000);
  await mockCmsRoutes(page);
  try {
    await page.goto(base+'/',{waitUntil:'domcontentloaded'});
    await page.locator('#v2-home-title').waitFor({state:'visible',timeout:7000});
    const opening=page.getByTestId('brand-intro');
    // The independent intro tests assert the full 5-second lifecycle.
    // The editorial test must work even if that transient overlay has finished.
    if(await opening.isVisible()){
      await page.getByRole('button',{name:'Skip brand introduction'}).click();
      await opening.waitFor({state:'hidden',timeout:4000});
    }
    await page.getByRole('heading',{name:'What customers are saying.'}).waitFor({state:'visible',timeout:7000});
    // The main editorial artwork remains present after the intro has exited.
    assert.equal(await page.getByLabel('Editorial collection artwork').count(),1,
      'premium imagery is underneath the introduction');
    await page.getByRole('textbox',{name:'Display name'}).fill('QA Reviewer');
    await page.getByRole('textbox',{name:'Your review'}).fill('The review submission test is private and awaits admin approval.');
    await page.getByRole('button',{name:'Submit review'}).click();
    await page.getByRole('status').filter({hasText:/Submitted for moderation/})
      .first().waitFor({state:'visible',timeout:6000});
    const external=page.getByRole('link',{name:'View independent Justdial listing'});
    assert.match(await external.getAttribute('href'),/^https:\/\/www\.justdial\.com\/Warangal\//);
    await page.screenshot({path:join(screenshots,'local-editorial-reviews-390.png'),animations:'disabled'});
    await page.goto(base+'/products/sample-plain-sherwani',{waitUntil:'domcontentloaded'});
    await page.getByRole('heading',{level:1,name:/Sample Plain Sherwani/}).waitFor({state:'visible',timeout:7000});
    await page.getByRole('button',{name:'40',exact:true}).click();
    const photo=page.getByRole('button',{name:/View photograph 2 of 3/});
    await photo.click();
    const share=page.getByRole('link',{name:/Share Sample Plain Sherwani.*catalogue on WhatsApp/});
    assert.match(await share.getAttribute('href'),/^https:\/\/api\.whatsapp\.com\/send\?text=/);
    await page.screenshot({path:join(screenshots,'local-plain-sherwani-demo-390.png'),animations:'disabled'});
    await page.goto(base+'/men/sherwani/plain',{waitUntil:'domcontentloaded'});
    await page.getByRole('link',{name:/Share Plain Sherwani catalogue on WhatsApp/}).waitFor({state:'visible',timeout:5000});
    await page.getByRole('link',{name:/Open demo garment/}).waitFor({state:'visible',timeout:5000});
    console.log('PASS_EDITORIAL_REVIEW_DEMO',JSON.stringify({width:390,reviewModerated:true,brandFilm:true,sampleGallery:true,catalogueShare:true}));
  }catch(error){
    failures.push({route:'editorial-review-demo',width:390,error:String(error?.stack||error)});
    console.error('FAIL_EDITORIAL_REVIEW_DEMO',String(error?.message||error));
  }finally{await context.close();}
}

/** Screenshot-worthy but bounded layout matrix. UI navigation stays a single
 * source of truth: no viewport-dependent duplicate route implementations. */
async function inspectViewportMatrix(){
  if(live||process.env.NB_MOCK_CMS!=='1')return;
  const viewports=[
    [280,653],[320,568],[344,720],[360,740],[375,667],
    [390,844],[414,896],[430,932],[480,800],[640,800],
    [768,1024],[820,1180],[1024,768],[1180,820],
    [1280,800],[1440,900],[1920,1080],[2560,1440]
  ];
  const coreRoutes=['/','/studio'];
  // Every route declared in src/storefront/navigation.ts, plus every
  // non-collection public screen and both real/demo product-detail templates.
  const otherRoutes=[
    '/men','/men/kurta-pyjama','/men/pathani','/men/jodhpuri','/men/tope',
    '/men/sherwani','/men/sherwani/handwork','/men/sherwani/plain',
    '/men/suits','/men/suits/handwork','/men/suits/plain','/men/marriage',
    '/men/marriage/jutti','/men/marriage/pagdi','/men/marriage/sadi',
    '/kids','/kids/kurta-pyjama','/kids/sherwani','/kids/pathani',
    '/kids/sadi','/kids/suits','/kids/jodhpuri','/kids/tope',
    '/contact','/search?q=sherwani',
    '/products/'+mockProduct.slug,'/products/sample-plain-sherwani',
    '/privacy-policy','/terms-and-conditions','/returns-and-exchanges'
  ];
  const representative=[[280,720],[320,720],[390,844],[768,1024],[1024,768],[1440,900],[1920,1080]];
  for(const [width,height] of viewports){
    for(const route of coreRoutes)await inspect(route,width,height,{matrix:true});
  }
  for(const route of otherRoutes){
    for(const [width,height] of representative)await inspect(route,width,height,{matrix:true});
  }
  const planned=viewports.length*coreRoutes.length+representative.length*otherRoutes.length;
  console.log('RESPONSIVE_MATRIX_COMPLETE',JSON.stringify({
    viewports:viewports.length,coreRoutes:coreRoutes.length,
    responsiveRoutes:otherRoutes.length,representativeBreakpoints:representative.length,planned
  }));
}


try{
  const routes=['/','/men','/kids','/men/sherwani','/men/kurta-pyjama','/men/marriage','/contact','/search?q=sherwani','/studio'];
  for(const route of routes)await inspect(route);
  if(!skipped)for(const width of [320,375,768,1024,1440]){
    await inspect('/',width,width<=375?740:900);
  }
  if(!skipped)await inspect('/',390,844,{reduce:true});
  if(!skipped)await inspectFloatingContactsAndProduct();
  if(!skipped)await inspectUnconfiguredContactFallback();
  if(!skipped)await inspectViewportMatrix();
  if(!skipped)await inspectEditorialRoutes();
  if(!skipped)await inspectCinematicHeroIntro();
  if(!skipped)await inspectConfiguredSocialIcons();
  if(!skipped)await inspectUnconfiguredSocialIcons();
}finally{await browser.close();}
if(skipped)console.log('LIVE_CHECK_INCOMPLETE: external deployment is not publicly accessible from this runner.');
console.log('BROWSER_SMOKE_SUMMARY',JSON.stringify({base,live,checks:results.length,failures:failures.length,skipped}));
if(failures.length)process.exitCode=1;
