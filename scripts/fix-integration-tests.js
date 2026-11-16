const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'tests', 'integration', 'whatsapp-to-financial.integration.spec.ts');
let src = fs.readFileSync(file, 'utf8');

const original = src;

// ---- Fix 1: 'executes the transfer and returns verified result after YES confirmation' ----
// Lines 232-248: add PIN step between YES and success assertion
const fix1_from = [
  "  it('executes the transfer and returns verified result after YES confirmation', async () => {",
  "    const { assistant } = buildServiceGraph();",
  "",
  "    // Phase 1: create preview",
  "    await assistant.processCustomerMessage('2348012345678', 'Send \u20a65,000 to Mum');",
  "",
  "    // Phase 2: confirm",
  "    const reply = await assistant.processCustomerMessage('2348012345678', 'YES');",
  "",
  "    expect(reply).toContain('Simulated Transfer Successful!');",
  "    expect(reply).toContain('Jane Adeleke');",
  "    expect(reply).toContain('\u20a65,000.00');",
  "    // New balance must be computed by the real MockFinancialService (not invented)",
  "    expect(reply).toMatch(/Available Balance.*\u20a6/);",
  "    // Must contain a real reference prefixed MOCK_TXN_",
  "    expect(reply).toMatch(/MOCK_TXN_/);",
  "  });",
].join('\r\n');

const fix1_to = [
  "  it('executes the transfer and returns verified result after YES confirmation', async () => {",
  "    const { assistant } = buildServiceGraph();",
  "",
  "    // Phase 1: create preview",
  "    await assistant.processCustomerMessage('2348012345678', 'Send \u20a65,000 to Mum');",
  "",
  "    // Phase 2: confirm \u2192 now prompts for PIN (new 4-step flow)",
  "    const pinPrompt = await assistant.processCustomerMessage('2348012345678', 'YES');",
  "    expect(pinPrompt).toContain('PIN');",
  "",
  "    // Phase 3: enter PIN \u2192 success",
  "    const reply = await assistant.processCustomerMessage('2348012345678', '1234');",
  "",
  "    expect(reply).toContain('Simulated Transfer Successful!');",
  "    expect(reply).toContain('Jane Adeleke');",
  "    expect(reply).toContain('\u20a65,000.00');",
  "    // New balance must be computed by the real MockFinancialService (not invented)",
  "    expect(reply).toMatch(/Available Balance.*\u20a6/);",
  "    // Must contain a real reference prefixed MOCK_TXN_",
  "    expect(reply).toMatch(/MOCK_TXN_/);",
  "  });",
].join('\r\n');

if (src.includes(fix1_from)) {
  src = src.replace(fix1_from, fix1_to);
  console.log('Fix 1 applied.');
} else {
  console.error('Fix 1: MATCH NOT FOUND');
  process.exit(1);
}

// ---- Fix 2: 'reflects a reduced balance after a confirmed transfer' ----
// Lines 250-261: add PIN step '1234' after 'YES' before balance check
const fix2_from = [
  "    // Phase 1 + Phase 2",
  "    await assistant.processCustomerMessage('2348012345678', 'Send \u20a65,000 to Mum');",
  "    await assistant.processCustomerMessage('2348012345678', 'YES');",
  "",
  "    // Verify actual balance in the store",
].join('\r\n');

const fix2_to = [
  "    // Phase 1 + Phase 2 + Phase 3 (PIN)",
  "    await assistant.processCustomerMessage('2348012345678', 'Send \u20a65,000 to Mum');",
  "    await assistant.processCustomerMessage('2348012345678', 'YES');   // returns PIN prompt",
  "    await assistant.processCustomerMessage('2348012345678', '1234');  // enter PIN \u2192 executes transfer",
  "",
  "    // Verify actual balance in the store",
].join('\r\n');

if (src.includes(fix2_from)) {
  src = src.replace(fix2_from, fix2_to);
  console.log('Fix 2 applied.');
} else {
  console.error('Fix 2: MATCH NOT FOUND');
  process.exit(1);
}

// ---- Fix 3: 'remembers the pending transfer context and confirms on "Yes, confirm it"' ----
// Lines 431-441: add PIN step after 'Yes'
const fix3_from = [
  "    // Turn 2: confirm \u2014 \"yes\" is in the confirmRegex",
  "    const confirmation = await assistant.processCustomerMessage('2348012345678', 'Yes');",
  "    expect(confirmation).toContain('Simulated Transfer Successful!');",
].join('\r\n');

const fix3_to = [
  "    // Turn 2: confirm \u2014 \"yes\" is in the confirmRegex \u2192 now returns PIN prompt",
  "    const pinPrompt2 = await assistant.processCustomerMessage('2348012345678', 'Yes');",
  "    expect(pinPrompt2).toContain('PIN');",
  "",
  "    // Turn 3: enter PIN \u2192 success",
  "    const confirmation = await assistant.processCustomerMessage('2348012345678', '1234');",
  "    expect(confirmation).toContain('Simulated Transfer Successful!');",
].join('\r\n');

if (src.includes(fix3_from)) {
  src = src.replace(fix3_from, fix3_to);
  console.log('Fix 3 applied.');
} else {
  console.error('Fix 3: MATCH NOT FOUND');
  process.exit(1);
}

// ---- Fix 4: 'queries new balance after a confirmed transfer and gets updated figure' ----
// Lines 443-457: add PIN step between YES and balance query
const fix4_from = [
  "    // Execute transfer",
  "    await assistant.processCustomerMessage('2348012345678', 'Send \u20a65,000 to Mum');",
  "    await assistant.processCustomerMessage('2348012345678', 'YES');",
  "",
  "    // Now query balance",
].join('\r\n');

const fix4_to = [
  "    // Execute transfer (3-step: preview \u2192 YES \u2192 PIN)",
  "    await assistant.processCustomerMessage('2348012345678', 'Send \u20a65,000 to Mum');",
  "    await assistant.processCustomerMessage('2348012345678', 'YES');   // PIN prompt",
  "    await assistant.processCustomerMessage('2348012345678', '1234');  // executes transfer",
  "",
  "    // Now query balance",
].join('\r\n');

if (src.includes(fix4_from)) {
  src = src.replace(fix4_from, fix4_to);
  console.log('Fix 4 applied.');
} else {
  console.error('Fix 4: MATCH NOT FOUND');
  process.exit(1);
}

// ---- Fix 5: 'preserves conversation isolation between two different customers' ----
// Lines 459-475: add PIN step for Adebayo after YES
const fix5_from = [
  "    // Adebayo confirms: must use HIS pending transfer (not Chioma's session)",
  "    const adebayoConfirm = await assistant.processCustomerMessage('2348012345678', 'YES');",
  "    expect(adebayoConfirm).toContain('Simulated Transfer Successful!');",
  "    expect(adebayoConfirm).toContain('Jane Adeleke');",
].join('\r\n');

const fix5_to = [
  "    // Adebayo confirms: must use HIS pending transfer (not Chioma's session)",
  "    // YES \u2192 PIN prompt, then PIN \u2192 success",
  "    const adebayoPinPrompt = await assistant.processCustomerMessage('2348012345678', 'YES');",
  "    expect(adebayoPinPrompt).toContain('PIN');",
  "    const adebayoConfirm = await assistant.processCustomerMessage('2348012345678', '1234');",
  "    expect(adebayoConfirm).toContain('Simulated Transfer Successful!');",
  "    expect(adebayoConfirm).toContain('Jane Adeleke');",
].join('\r\n');

if (src.includes(fix5_from)) {
  src = src.replace(fix5_from, fix5_to);
  console.log('Fix 5 applied.');
} else {
  console.error('Fix 5: MATCH NOT FOUND');
  process.exit(1);
}

if (src !== original) {
  fs.writeFileSync(file, src, 'utf8');
  console.log('All fixes written successfully.');
} else {
  console.log('No changes made (src unchanged).');
}
