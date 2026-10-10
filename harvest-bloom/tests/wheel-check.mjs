import assert from 'node:assert/strict'
import {chromium,webkit} from '@playwright/test'
import {products} from '../src/data/products.js'
import {formatMoney} from '../src/lib/format.js'
const url=process.env.TEST_URL || 'http://127.0.0.1:4173'
for(const engine of (process.env.TEST_ENGINE ? [process.env.TEST_ENGINE] : ['edge','webkit'])){
 const browser=engine==='edge'?await chromium.launch({channel:'msedge',headless:true}):await webkit.launch({headless:true})
 try{for(const [width,height] of [[1440,900],[1440,640],[1024,768],[768,1024],[844,390],[390,844],[320,568]].filter(size=>!process.env.TEST_SIZE || size.join('x')===process.env.TEST_SIZE)){
  const p=await browser.newPage({viewport:{width,height}});const errors=[];p.on('pageerror',e=>errors.push(e.message))
  await p.goto(url,{waitUntil:'domcontentloaded',timeout:60000})
  await p.waitForFunction(()=>[...document.querySelectorAll('.loop__img')].every(e=>e.complete&&e.naturalWidth>0))
  await p.waitForFunction(()=>document.querySelector('video')?.readyState>=1 || document.querySelector('video')?.error)
  await p.evaluate(()=>document.fonts.ready)
  const pinned=await p.locator('.collection__track').evaluate(e=>e.classList.contains('is-pinned'))
  if(pinned){await p.locator('.collection__track').evaluate(e=>window.scrollTo({top:e.getBoundingClientRect().top+scrollY,behavior:'instant'}))}
  else await p.locator('.collection__body').evaluate(e=>window.scrollTo({top:e.getBoundingClientRect().top+scrollY-document.querySelector('.hdr').getBoundingClientRect().height-16,behavior:'instant'}))
  await p.locator('.loop__dot').nth(0).click()
  if(pinned)await p.waitForFunction(()=>Math.abs(document.querySelector('.collection__track').getBoundingClientRect().top)<1)
  await p.waitForTimeout(800)
  for(let i=0;i<products.length;i++){
   if(i){
    const r=await p.locator('.loop__stage').boundingBox()
    await p.mouse.move(Math.min(width-30,r.x+r.width/2),Math.max(100,Math.min(height-30,r.y+r.height/2)))
    await p.mouse.wheel(0,150)
   }
   try { await p.waitForFunction(id=>document.querySelector('.panel')?.dataset.productId===id,products[i].id) } catch(e) { console.log('Product selection failed',engine,width,height,i,await p.evaluate(()=>({id:document.querySelector('.panel')?.dataset.productId,stage:document.querySelector('.loop__stage').getBoundingClientRect().toJSON(),y:scrollY}))); throw e }
   await p.waitForTimeout(650)
   assert.equal(await p.locator('.loop__item[data-focused=true]').getAttribute('id'),'loop-item-'+products[i].id)
   assert.equal(await p.locator('.panel__name').innerText(),products[i].name)
   assert.equal(await p.locator('.panel__desc').innerText(),products[i].description)
   assert.equal(await p.locator('.panel__rateValue').innerText(),formatMoney(products[i].pricePer100g))
   {
    await p.waitForFunction(() => {
     const item=document.querySelector('.loop__item[data-focused=true]')?.getBoundingClientRect()
     const panel=document.querySelector('.panel')?.getBoundingClientRect()
     return item && panel && Math.abs(item.y+item.height/2-panel.y-panel.height/2)<1
    }, {}, {timeout:3000})
    const item=await p.locator('.loop__item[data-focused=true]').boundingBox()
    const panel=await p.locator('.panel').boundingBox()
    assert(Math.abs(item.y+item.height/2-panel.y-panel.height/2)<1,'product is not opposite its details: '+JSON.stringify({engine,width,height,index:i,item,panel,delta:item.y+item.height/2-panel.y-panel.height/2}))
   }
   const layoutCheck=await p.evaluate(()=>{
    const stage=document.querySelector('.loop__stage').getBoundingClientRect(),panel=document.querySelector('.panel').getBoundingClientRect()
    const images=[...document.querySelectorAll('.loop__item')].filter(e=>parseFloat(e.style.opacity)>0.15).map(e=>e.querySelector('img').getBoundingClientRect()).filter(r=>r.bottom>stage.top && r.top<stage.bottom && r.left<stage.right)
    const packsStayRight=images.every(r=>r.left>panel.right+4)
    const focus=document.querySelector('.loop__item[data-focused=true]').getBoundingClientRect()
    const noOverlap=images.every((a,i)=>images.slice(i+1).every(b=>a.right+4<=b.left || b.right+4<=a.left || a.bottom+4<=b.top || b.bottom+4<=a.top))
    return {packsStayRight,noOverlap,rightFocus:focus.x+focus.width/2>innerWidth*0.7}
   })
   assert(layoutCheck.packsStayRight && layoutCheck.noOverlap && layoutCheck.rightFocus,'cycle location or image separation failed: '+JSON.stringify({engine,width,height,i,layoutCheck}))
   const field=p.locator('.panel .weight__input');const weightBox=await field.boundingBox();const addBox=await p.locator('.panel__add').boundingBox()
   assert(weightBox.y>=60 && addBox.y+addBox.height<=height+1,'weight and add controls must be visible together with the cycle: '+JSON.stringify({engine,width,height,weightBox,addBox}))
   const scrollBefore=await p.evaluate(()=>scrollY)
   await field.fill('300');await field.press('Enter')
   assert.equal(await field.inputValue(),'300')
   assert.equal(await p.locator('.panel__totalValue').innerText(),formatMoney(products[i].pricePer100g*3))
   assert.equal(await p.evaluate(()=>scrollY),scrollBefore,'editing weight must not scroll away from the cycle')
   assert(await p.locator('.panel__details').evaluate(e=>getComputedStyle(e).overflowY==='visible' && e.scrollHeight<=e.clientHeight+1),'full details must be visible without internal scrolling')
   assert.equal(await p.locator('.loop__nav').count(),0)
  }
  // Continuing after the last product must release ordinary page scrolling.
  let r=await p.locator('.loop__stage').boundingBox()
  await p.mouse.move(Math.min(width-30,r.x+r.width/2),Math.max(100,Math.min(height-30,r.y+r.height/2)))
  const before=await p.evaluate(()=>scrollY);await p.mouse.wheel(0,150)
  await p.waitForFunction(before=>scrollY>before+20,before)
  // Reverse wheel direction must select the previous product.
  if(pinned)await p.locator('.loop__dot').nth(5).click()
  else await p.locator('.loop__stage').scrollIntoViewIfNeeded()
  await p.waitForTimeout(700)
  r=await p.locator('.loop__stage').boundingBox()
  await p.mouse.move(Math.min(width-30,r.x+r.width/2),Math.max(100,Math.min(height-30,r.y+r.height/2)))
  await p.mouse.wheel(0,-150)
  await p.waitForFunction(()=>document.querySelector('.panel')?.dataset.productId==='almond')
  assert.deepEqual(errors,[])
  console.log('PASS mouse wheel, matching price/description, alignment and boundary release',engine,width+'x'+height)
  await p.close()
 }}finally{await browser.close()}
}
