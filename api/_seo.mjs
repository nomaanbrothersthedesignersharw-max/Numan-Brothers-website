/** HTML safety utilities shared by Vercel product SEO and offline tests. */
export const escapeHtml=(value='')=>String(value)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

export function canonicalOrigin(value){
  if(!value)return null;
  try{
    const url=new URL(value);
    if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||
       url.search||url.hash||url.origin!==value.replace(/\/$/,''))return null;
    return url.origin;
  }catch{return null}
}
export function renderProductHtml(template,product,canonical=null){
  if(!/<div\s+id="root"\s*><\/div>/i.test(template))
    throw new Error('Missing expected Vite application root in HTML template');
  const title=escapeHtml(product.title)+' | Nomaan Brothers';
  const desc=escapeHtml((product.description||'Explore traditional occasionwear at Nomaan Brothers, Warangal.').slice(0,210));
  const images=Array.isArray(product.image_urls)?product.image_urls.filter(x=>{
    try{return new URL(x).protocol==='https:'}catch{return false}
  }):[];
  const photo=images[0]?escapeHtml(images[0]):'';
  const handle=typeof product.slug==='string' && product.slug.length<=120 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.slug) ? product.slug : product.id;
  const canonicalUrl=canonical ? canonical+'/products/'+encodeURIComponent(handle):null;
  const schema={
    '@context':'https://schema.org','@type':'Product',name:product.title,
    sku:product.sku,description:product.description||undefined,
    image:images.length?images:undefined,
    brand:{'@type':'Brand',name:'Nomaan Brothers'},
    ...(canonicalUrl?{url:canonicalUrl}:{}),
    ...(Number(product.offer_price??product.price)>0?{offers:{
      '@type':'Offer',priceCurrency:'INR',price:Number(product.offer_price??product.price),
      availability:'https://schema.org/InStock',
      itemCondition:'https://schema.org/NewCondition',
      ...(canonicalUrl?{url:canonicalUrl}:{}),
    }}:{}),
    ...(Number(product.review_count)>0 && Number(product.rating_value)>0?{aggregateRating:{
      '@type':'AggregateRating',
      ratingValue:Number(Number(product.rating_value).toFixed(1)),
      reviewCount:Math.floor(Number(product.review_count)),
      bestRating:5,
      worstRating:1,
    }}:{}),
  };
  const deptPath=product.department==='kids'?'/kids':'/men';
  const deptLabel=product.department==='kids'?'Kids Wear':"Men's Wear";
  const breadcrumb=canonical?{
    '@context':'https://schema.org',
    '@type':'BreadcrumbList',
    itemListElement:[
      {'@type':'ListItem',position:1,name:'Home',item:canonical+'/'},
      {'@type':'ListItem',position:2,name:deptLabel,item:canonical+deptPath},
      {'@type':'ListItem',position:3,name:product.title,item:canonicalUrl},
    ],
  }:null;
  const tags=[
    '<title>'+title+'</title>',
    '<meta name="description" content="'+desc+'"/>',
    '<meta property="og:type" content="product"/>',
    '<meta property="og:title" content="'+title+'"/>',
    '<meta property="og:description" content="'+desc+'"/>',
    ...(photo?['<meta property="og:image" content="'+photo+'"/>']:[]),
    ...(canonicalUrl?['<link rel="canonical" href="'+escapeHtml(canonicalUrl)+'"/>']:[]),
    '<script type="application/ld+json">'+JSON.stringify(schema).replace(/</g,'\\u003c')+'</script>',
    ...(breadcrumb?['<script type="application/ld+json">'+JSON.stringify(breadcrumb).replace(/</g,'\\u003c')+'</script>']:[]),
  ].join('\n');
  const article='<article class="seo-product" style="max-width:1040px;margin:3rem auto;padding:0 1.5rem">'+
    '<p>Nomaan Brothers — '+escapeHtml(product.department==='kids'?'Kids Wear':"Men's Wear")+'</p>'+
    '<h1>'+escapeHtml(product.title)+'</h1>'+
    (photo?'<img alt="'+escapeHtml(product.title)+'" src="'+photo+'" width="600" height="800" loading="eager"/>':'')+
    (product.fabric?'<p>Fabric: '+escapeHtml(product.fabric)+'</p>':'')+
    (product.description?'<p>'+escapeHtml(product.description)+'</p>':'')+
    '<p>SKU: '+escapeHtml(product.sku)+'</p>'+
    '<a href="/'+(product.department==='kids'?'kids':'men')+'">Browse collections</a></article>';
  return template
    .replace(/<title>[\s\S]*?<\/title>/i,'')
    .replace(/<meta\s+name="description"[^>]*>/i,'')
    .replace(/<meta\s+property="og:(?:type|title|description)"[^>]*>/gi,'')
    .replace('</head>',tags+'\n</head>')
    .replace(/<div\s+id="root"\s*><\/div>/i,'<div id="root">'+article+'</div>');
}
export function renderNotFoundHtml(template){
  return template
    .replace(/<title>[\s\S]*?<\/title>/i,'<title>Product not found | Nomaan Brothers</title>')
    .replace('</head>','<meta name="robots" content="noindex, nofollow"/>\n</head>')
    .replace(/<div\s+id="root"\s*><\/div>/i,
      '<div id="root"><main><h1>Product not found</h1><a href="/men">Browse collections</a></main></div>');
}
