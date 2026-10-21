// Fit transparent portrait bounds without modifying the source image or cropping opaque portraits.
(() => {
  function fit(img) {
    if (!img.naturalWidth || !img.closest('.portrait')) return;
    const frame = img.parentElement;
    try {
      const c = document.createElement('canvas'); c.width = 96; c.height = 96;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, 96, 96);
      const data = ctx.getImageData(0, 0, 96, 96).data;
      let l = 96, r = -1, t = 96, b = -1;
      for (let y=0;y<96;y++) for(let x=0;x<96;x++) if(data[(y*96+x)*4+3]>32){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}
      if(r<l || (l===0 && r===95 && t===0 && b===95)) return;
      const x=l/96*img.naturalWidth, y=t/96*img.naturalHeight;
      const w=(r-l+1)/96*img.naturalWidth, h=(b-t+1)/96*img.naturalHeight;
      const update=()=>{
        const fw=frame.clientWidth, fh=frame.clientHeight; if(!fw || !fh)return;
        const scale=Math.min(fw*.94/w,fh*.94/h);
        Object.assign(img.style,{position:'absolute',maxWidth:'none',width:img.naturalWidth*scale+'px',height:img.naturalHeight*scale+'px',left:((fw-w*scale)/2-x*scale)+'px',top:(fh-h*scale-y*scale)+'px'});
      };
      update(); const ro=new ResizeObserver(()=>{if(!img.isConnected){ro.disconnect();return;}update();});ro.observe(frame);
    } catch (_) { /* Keep object-fit for images that cannot be sampled. */ }
  }
  document.addEventListener('load', e=>{if(e.target instanceof HTMLImageElement && document.body.dataset.banquetArt==='true')fit(e.target);},true);
})();
