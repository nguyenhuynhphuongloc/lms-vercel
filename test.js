const key = 'AIzaSyCGZVEtso40zlHdygEo-C5I1skJ2684_IQ';
async function test(model) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: 'Hello' }] }] })
  });
  if (!res.ok) {
    const text = await res.text();
    console.log(model, 'FAILED:', res.status, text);
  } else {
    console.log(model, 'SUCCESS');
  }
}
async function run() {
  await test('gemini-3.8-flash');
  await test('gemini-3.7-flash');
  await test('gemini-3.6-flash');
  await test('gemini-1.5-flash-latest');
}
run();
