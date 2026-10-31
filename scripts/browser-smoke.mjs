import {chromium} from 'playwright-core';
import fs from 'node:fs';
let browser;
try{
  browser=await chromium.launch({
    channel:'chrome',headless:true,
    args:['--no-sandbox','--enable-webgl','--use-gl=angle',
      '--use-angle=swiftshader','--enable-unsafe-swiftshader']
  });
  const page=await browser.newPage({viewport:{width:1280,height:850},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  let loaded=false;
  for(let i=0;i<35;i++){
    try{
      const r=await fetch('http://127.0.0.1:5173/');
      if(r.ok){loaded=true;break;}
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  if(!loaded)throw new Error('Vite server not responding');
  await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle'});
  await page.waitForSelector('#desk canvas',{timeout:20000});
  fs.mkdirSync('screenshots',{recursive:true});
  await page.screenshot({path:'screenshots/00-initial.png'});
  const initialThumbnail=await page.screenshot({type:'jpeg',quality:48,
    clip:{x:405,y:40,width:440,height:620}});
  console.log('INITIAL_JPEG_BASE64:'+initialThumbnail.toString('base64'));
  await page.locator('#settings-open').click();
  await page.locator('#speed').evaluate(input=>{
    input.value='700';input.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.locator('#settings-close').click();
  for(let i=0;i<8;i++)await page.keyboard.press('1');
  await page.waitForTimeout(6300);
  await page.screenshot({path:'screenshots/08-chain.png'});
  const before=fs.readFileSync('screenshots/00-initial.png');
  const after=fs.readFileSync('screenshots/08-chain.png');
  const changed=!before.equals(after);
  if(!changed)throw new Error('Eight chain commands did not change the rendered Pixi canvas');
  const title=await page.title();
  const count=await page.locator('#desk canvas').count();
  const notice=await page.locator('#notice').textContent();
  const pixel=await page.evaluate(()=>{
    const canvas=document.querySelector('#desk canvas');
    return {width:canvas?.width,height:canvas?.height};
  });
  console.log('BROWSER_SMOKE',JSON.stringify({title,count,notice,pixel,changed,errors}));
  const thumbnail=await page.screenshot({type:'jpeg',quality:48,
    clip:{x:405,y:40,width:440,height:620}});
  console.log('VISUAL_JPEG_BASE64:'+thumbnail.toString('base64'));
  if(errors.length)throw new Error('Runtime page errors: '+errors.join('; '));
  if(count!==1)throw new Error('Missing Pixi canvas');
  if(pixel.width<300||pixel.height<300)throw new Error('Canvas did not initialize');
  console.log('BROWSER_SMOKE_SUCCESS');
}catch(error){
  console.error('BROWSER_SMOKE_FAILED',error);
  process.exitCode=1;
}finally{await browser?.close();}
