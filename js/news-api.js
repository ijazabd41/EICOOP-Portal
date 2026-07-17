/* Odoo Blog News API integration
Expected endpoint: GET /api/website/news?limit=6&lang=en_US
Expected JSON: {success:true, posts:[{id,title,subtitle,published_date,image_url,url}]}
*/
(async function(){
  const grid=document.getElementById('newsGrid');
  if(!grid) return;
  try{
    const r=await fetch('/api/website/news?limit=6&lang=en_US',{credentials:'include'});
    if(!r.ok) return;
    const data=await r.json();
    if(!data.success || !Array.isArray(data.posts) || !data.posts.length) return;
    grid.innerHTML=data.posts.map(p=>`<article class="news-card"><img src="${p.image_url||'assets/page9.jpg'}" alt="${p.title||'News'}"><div class="content"><small>${p.published_date||'Latest update'}</small><h3>${p.title||''}</h3><p>${p.subtitle||''}</p><a href="${p.url||'#'}">Read more →</a></div></article>`).join('');
  }catch(e){ console.info('News API preview fallback in use'); }
})();
