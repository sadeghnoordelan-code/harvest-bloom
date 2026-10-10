import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { pathToFileURL, fileURLToPath } from 'node:url'
const modulePath = process.env.PLAYWRIGHT_MODULE
const { chromium, webkit } = modulePath ? await import(pathToFileURL(modulePath).href) : await import('@playwright/test')
const base = process.env.TEST_URL || 'http://127.0.0.1:4173'
const output = new URL('../verification/', import.meta.url)
await fs.mkdir(output, { recursive: true })
const names = ['Barberries', 'Pistachios', 'Walnuts', 'Hazelnuts', 'Almonds', 'Cashews']
const sizes = [[320,568],[390,844],[760,600],[768,1024],[1024,768],[1101,700],[1280,720],[1440,900],[1920,1080],[844,390]].filter(size=>!process.env.TEST_SIZES || process.env.TEST_SIZES.split(',').includes(size.join('x')))
const engines = process.env.TEST_ENGINES === 'all' ? ['edge','webkit'] : [process.env.TEST_ENGINES || 'edge']
const results = []
for (const engine of engines) {
 const browser = engine === 'webkit' ? await webkit.launch({headless:true}) : await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'msedge',headless:true})
 try {
  for (const [width,height] of sizes) {
   const context = await browser.newContext({viewport:{width,height},hasTouch:width<=1100,reducedMotion:'reduce'})
   const page = await context.newPage()
   const errors=[]; const missing=[]
   page.on('pageerror',e=>errors.push(e.message))
   page.on('response',r=>{if(r.status()>=400 && r.url().startsWith(base))missing.push(r.status()+' '+r.url())})
   await page.goto(base,{waitUntil:'domcontentloaded',timeout:45000})
   await page.locator('.loop__item[data-focused="true"]').waitFor()
   assert.equal(await page.locator('.hdr__sheet').isVisible(),false,'closed mobile menu must be hidden')
   if(width<=760){
    await page.getByRole('button',{name:'Open menu',exact:true}).click()
    assert.equal(await page.locator('.hdr__sheet').isVisible(),true)
    await page.keyboard.press('Escape')
    assert.equal(await page.locator('.hdr__sheet').isVisible(),false)
   }
   await page.waitForFunction(()=>[...document.querySelectorAll('.loop__img')].every(e=>e.complete&&e.naturalWidth>0),{},{timeout:25000})
   const pinned=await page.locator('.collection__track').evaluate(e=>e.classList.contains('is-pinned'))
   for(let i=0;i<names.length;i++){
    await page.locator('.loop__dot').nth(i).click()
    await page.waitForFunction(name=>document.querySelector('.panel__name')?.textContent===name,names[i])
    await page.waitForTimeout(100)
    const rect=await page.locator('.loop__item[data-focused="true"] .loop__img').evaluate(e=>{
     const r=e.getBoundingClientRect(),s=e.closest('.loop__stage').getBoundingClientRect()
     return {left:r.left,right:r.right,top:r.top-s.top,bottom:r.bottom-s.top,stage:s.height,width:window.innerWidth}
    })
    assert(rect.left>=-1&&rect.right<=rect.width+1,engine+' '+width+' '+names[i]+' image clipped horizontally: '+JSON.stringify(rect))
    assert(rect.top>=-1&&rect.bottom<=rect.stage+1,engine+' '+width+' image clipped vertically')
    if(pinned){const r=await page.locator('.panel__add').boundingBox();assert(r.y>=60&&r.y+r.height<=height+1,'pinned buy button unreachable')}
   }
   const controls=await page.locator('.loop__nav,.loop__dots').evaluateAll(els=>els.map(e=>e.getBoundingClientRect().toJSON()))
   const [a,b]=controls
   assert(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top,'arrows overlap product selectors')
   await page.locator('.loop__stage').scrollIntoViewIfNeeded()
   if(!pinned){
    await page.locator('.loop__stage').focus()
    await page.keyboard.press('Home')
    await page.waitForFunction(()=>document.querySelector('.panel__name').textContent==='Barberries')
    await page.keyboard.press(await page.locator('.loop').getAttribute('data-layout') === 'ring' ? 'ArrowDown' : 'ArrowRight')
    await page.waitForFunction(()=>document.querySelector('.panel__name').textContent==='Pistachios')
    await page.locator('.loop__dot').nth(0).click()
    await page.waitForFunction(()=>document.querySelector('.panel__name').textContent==='Barberries')
    const r=await page.locator('.loop__stage').boundingBox()
    await page.mouse.move(r.x+r.width/2,r.y+r.height/2)
    await page.mouse.down()
    const ring = await page.locator('.loop').getAttribute('data-layout') === 'ring'
    await page.mouse.move(r.x+r.width/2-(ring?0:140),r.y+r.height/2-(ring?140:0),{steps:10})
    await page.mouse.up()
    await page.waitForFunction(()=>document.querySelector('.panel__name').textContent==='Pistachios')
   }
   await page.locator('.loop__dot').nth(0).click()
   await page.waitForFunction(()=>document.querySelector('.panel__name').textContent==='Barberries')
   const weight=page.locator('#weight-barberries')
   await weight.fill('255'); await weight.blur()
   assert.equal(await weight.inputValue(),'260')
   assert.equal(await page.locator('.panel__totalValue').innerText(),'$30.68')
   await page.locator('.panel__add').click()
   assert.equal(await page.locator('.order__line').count(),1)
   await page.reload({waitUntil:'domcontentloaded'})
   await page.locator('#order-weight-barberries').waitFor()
   assert.equal(await page.locator('#order-weight-barberries').inputValue(),'260','stored cart was lost on reload')
   await page.locator('#order-weight-barberries').fill('500');await page.locator('#order-weight-barberries').blur()
   assert((await page.locator('.order__amount').innerText()).endsWith('$59.00'))
   await page.getByRole('button',{name:'Proceed to Payment'}).click()
   assert.match(await page.locator('.order__notice').innerText(),/Nothing has been charged/)
   assert(!(await page.locator('.order__notice').innerText()).includes('src/lib'),'implementation details exposed')
   await page.getByRole('button',{name:'Clear order',exact:true}).click()
   assert.equal(await page.locator('.order__line').count(),0)
   const dimensions=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth}))
   assert(dimensions.scroll<=dimensions.viewport+1,'horizontal page overflow')
   await page.locator('.loop__stage').scrollIntoViewIfNeeded()
   await page.screenshot({path:fileURLToPath(new URL(engine+'-'+width+'x'+height+'.png',output))})
   assert.deepEqual(errors,[],'browser runtime errors'); assert.deepEqual(missing,[],'failed site assets')
   results.push({engine,width,height,pinned,status:'passed'})
   console.log('PASS',engine,width+'x'+height)
   await context.close()
  }
 } finally {await browser.close()}
}

// Exercise motion, video decoding, resize transitions and touch independently
// of the reduced-motion layout matrix above.
const smoke = await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'msedge',headless:true})
try {
 const context=await smoke.newContext({viewport:{width:390,height:844},hasTouch:true})
 const page=await context.newPage()
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto(base,{waitUntil:'domcontentloaded'})
 await page.waitForFunction(()=>document.querySelector('video').readyState>=2,{},{timeout:30000})
 await page.evaluate(()=>window.scrollTo({top:1200,behavior:'instant'}))
 await page.waitForFunction(()=>document.querySelector('video').currentTime>0.1)
 await page.locator('.loop__dot').nth(3).tap()
 await page.waitForFunction(()=>document.querySelector('.panel__name').textContent==='Hazelnuts')
 await page.locator('.loop__stage').scrollIntoViewIfNeeded()
 const thumb=await page.locator('#loop-item-walnut').boundingBox()
 if(thumb && thumb.x+thumb.width/2>0 && thumb.x+thumb.width/2<390){
  await page.touchscreen.tap(thumb.x+thumb.width/2,thumb.y+thumb.height/2)
  await page.waitForFunction(()=>document.querySelector('.panel__name').textContent==='Walnuts')
 }
 await page.setViewportSize({width:1440,height:900})
 await page.waitForFunction(()=>document.querySelector('.loop').dataset.layout==='ring')
 await page.locator('.loop__dot').nth(2).click()
 await page.waitForFunction(()=>document.querySelector('.panel__name').textContent==='Walnuts')
 await page.setViewportSize({width:390,height:844})
 await page.waitForFunction(()=>document.querySelector('.loop').dataset.layout==='strip')
 await page.locator('.loop__dot').nth(5).tap()
 await page.waitForFunction(()=>document.querySelector('.panel__name').textContent==='Cashews')
 await page.addInitScript(()=>localStorage.setItem('harvest-bloom.cart.v1',JSON.stringify([{id:'__proto__',grams:200},{id:'walnut',grams:200},{id:'walnut',grams:300},{id:'unknown',grams:100}])))
 await page.reload({waitUntil:'domcontentloaded'})
 await page.locator('.order__line').waitFor()
 assert.equal(await page.locator('.order__line').count(),1,'invalid and duplicate stored products')
 assert.equal(await page.locator('#order-weight-walnut').inputValue(),'200')
 assert.deepEqual(errors,[])
 await context.close()
 const failure=await smoke.newPage({viewport:{width:390,height:844}})
 await failure.route('**/hero.mp4',r=>r.abort())
 await failure.goto(base,{waitUntil:'domcontentloaded'})
 await failure.locator('.hero__loading--error').waitFor()
 const heroHeight=await failure.locator('#hero').evaluate(e=>e.getBoundingClientRect().height)
 assert(heroHeight<=850,'failed video leaves an excessively tall blank section')
 await failure.close()
 results.push({engine:'edge',scenario:'motion, video, touch, resize, invalid stored cart, failed video',status:'passed'})
 console.log('PASS motion, video, touch, resize, storage recovery, video fallback')
}finally{await smoke.close()}

await fs.writeFile(new URL('results.json',output),JSON.stringify({url:base,checkedAt:new Date().toISOString(),results},null,2))
console.log('All',results.length,'browser configurations passed.')
