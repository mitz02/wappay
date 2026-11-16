const fs = require('fs');
const path = require('path');

const intSpec = path.join(__dirname, '..', 'src', 'tests', 'integration', 'whatsapp-to-financial.integration.spec.ts');

let raw = fs.readFileSync(intSpec, 'utf8');

// All replacements - using escaped chars carefully
const replacements = [
  // 1. Domestic transfer preview: "Reply *YES* to confirm" -> "Enter Transaction PIN"
  [
    "    expect(reply).toContain('Reply *YES* to confirm');\r\n    expect(reply).toContain('0111222333'); // Mum's account number",
    "    expect(reply).toContain('Enter Transaction PIN'); // PIN button shown immediately\r\n    expect(reply).toContain('0111222333'); // Mum's account number",
  ],

  // 2. Multi-turn test preview assertion
  [
    "    expect(preview).toContain('Reply *YES* to confirm');",
    "    expect(preview).toContain('Enter Transaction PIN');",
  ],

  // 3. "executes the transfer" test - full replacement
  [
    "  it('executes the transfer via secure PIN input after preview', async () => {\r\n    const { assistant } = buildServiceGraph();\r\n\r\n    // Phase 1: preview \u2014 bot shows transfer details with Enter PIN button\r\n    const preview = await assistant.processCustomerMessage('2348012345678', 'Send \u20a65,000 to Mum');\r\n    expect(preview).toContain('Simulated Transfer Confirmation');\r\n    expect(preview).toContain('Enter Transaction PIN');\r\n\r\n    // Phase 2: user submits PIN via secure WhatsApp Flow input \u2192 success\r\n    const reply = await assistant.submitTransferPin('2348012345678', '1234');\r\n\r\n    expect(reply).toContain('Simulated Transfer Successful!');\r\n    expect(reply).toContain('Jane Adeleke');\r\n    expect(reply).toContain('\u20a65,000.00');\r\n    // New balance must be computed by the real MockFinancialService (not invented)\r\n    expect(reply).toMatch(/Available Balance.*\u20a6/);\r\n    // Must contain a real reference prefixed MOCK_TXN_\r\n    expect(reply).toMatch(/MOCK_TXN_/);\r\n  });",
    null, // skip — will be inserted in correct place below
  ],
];

// Apply simple replacements
for (const [from, to] of replacements) {
  if (to === null) continue; // skip nulls
  if (!raw.includes(from)) {
    console.error('NOT FOUND:', JSON.stringify(from.slice(0, 60)));
    process.exit(1);
  }
  raw = raw.replace(from, to);
}

// 3. Replace "executes the transfer" test entirely
const oldExecTest = "  it('executes the transfer and returns verified result after YES confirmation', async () => {\r\n    const { assistant } = buildServiceGraph();\r\n\r\n    // Phase 1: create preview\r\n    await assistant.processCustomerMessage('2348012345678', 'Send \u20a65,000 to Mum');\r\n\r\n    // Phase 2: confirm \u2192 now prompts for PIN (new 4-step flow)\r\n    const pinPrompt = await assistant.processCustomerMessage('2348012345678', 'YES');\r\n    expect(pinPrompt).toContain('PIN');\r\n\r\n    // Phase 3: enter PIN \u2192 success\r\n    const reply = await assistant.processCustomerMessage('2348012345678', '1234');\r\n\r\n    expect(reply).toContain('Simulated Transfer Successful!');\r\n    expect(reply).toContain('Jane Adeleke');\r\n    expect(reply).toContain('\u20a65,000.00');\r\n    // New balance must be computed by the real MockFinancialService (not invented)\r\n    expect(reply).toMatch(/Available Balance.*\u20a6/);\r\n    // Must contain a real reference prefixed MOCK_TXN_\r\n    expect(reply).toMatch(/MOCK_TXN_/);\r\n  });";

const newExecTest = "  it('executes the transfer via secure PIN input after preview', async () => {\r\n    const { assistant } = buildServiceGraph();\r\n\r\n    // Phase 1: preview \u2014 bot shows transfer details with Enter PIN button\r\n    const preview = await assistant.processCustomerMessage('2348012345678', 'Send \u20a65,000 to Mum');\r\n    expect(preview).toContain('Simulated Transfer Confirmation');\r\n    expect(preview).toContain('Enter Transaction PIN');\r\n\r\n    // Phase 2: user submits PIN via secure WhatsApp Flow input \u2192 success\r\n    const reply = await assistant.submitTransferPin('2348012345678', '1234');\r\n\r\n    expect(reply).toContain('Simulated Transfer Successful!');\r\n    expect(reply).toContain('Jane Adeleke');\r\n    expect(reply).toContain('\u20a65,000.00');\r\n    // New balance must be computed by the real MockFinancialService (not invented)\r\n    expect(reply).toMatch(/Available Balance.*\u20a6/);\r\n    // Must contain a real reference prefixed MOCK_TXN_\r\n    expect(reply).toMatch(/MOCK_TXN_/);\r\n  });";

if (!raw.includes(oldExecTest)) {
  console.error('NOT FOUND: executes test');
  process.exit(1);
}
raw = raw.replace(oldExecTest, newExecTest);

// 4. "reflects reduced balance" test -> submitTransferPin
const oldReduced = "    // Phase 1 + Phase 2 + Phase 3 (PIN)\r\n    await assistant.processCustomerMessage('2348012345678', 'Send \u20a65,000 to Mum');\r\n    await assistant.processCustomerMessage('2348012345678', 'YES');   // returns PIN prompt\r\n    await assistant.processCustomerMessage('2348012345678', '1234');  // enter PIN \u2192 executes transfer";
const newReduced = "    // Phase 1: preview; Phase 2: submit PIN via secure input\r\n    await assistant.processCustomerMessage('2348012345678', 'Send \u20a65,000 to Mum');\r\n    await assistant.submitTransferPin('2348012345678', '1234'); // secure PIN \u2192 executes transfer";

if (!raw.includes(oldReduced)) {
  console.error('NOT FOUND: reduced balance');
  process.exit(1);
}
raw = raw.replace(oldReduced, newReduced);

// 5. "remembers pending transfer" confirmation step -> submitTransferPin
const oldRemember = "    // Turn 2: confirm \u2014 \"yes\" is in the confirmRegex \u2192 now returns PIN prompt\r\n    const pinPrompt2 = await assistant.processCustomerMessage('2348012345678', 'Yes');\r\n    expect(pinPrompt2).toContain('PIN');\r\n\r\n    // Turn 3: enter PIN \u2192 success\r\n    const confirmation = await assistant.processCustomerMessage('2348012345678', '1234');\r\n    expect(confirmation).toContain('Simulated Transfer Successful!');";
const newRemember = "    // Turn 2: user submits PIN via secure WhatsApp Flow input \u2192 success\r\n    const confirmation = await assistant.submitTransferPin('2348012345678', '1234');\r\n    expect(confirmation).toContain('Simulated Transfer Successful!');";

if (!raw.includes(oldRemember)) {
  console.error('NOT FOUND: remember');
  process.exit(1);
}
raw = raw.replace(oldRemember, newRemember);

// 6. "queries new balance" test -> submitTransferPin
const oldQuery = "    // Execute transfer (2-step: preview \u2192 submitTransferPin via secure input)\r\n    await assistant.processCustomerMessage('2348012345678', 'Send \u20a65,000 to Mum');\r\n    await assistant.submitTransferPin('2348012345678', '1234'); // secure PIN \u2192 executes transfer";
// This was already patched by fix-integration-tests previously, check
if (!raw.includes(oldQuery)) {
  // Try alternate
  const alt = "    // Execute transfer (3-step: preview \u2192 YES \u2192 PIN)\r\n    await assistant.processCustomerMessage('2348012345678', 'Send \u20a65,000 to Mum');\r\n    await assistant.processCustomerMessage('2348012345678', 'YES');   // PIN prompt\r\n    await assistant.processCustomerMessage('2348012345678', '1234');  // executes transfer";
  if (raw.includes(alt)) {
    raw = raw.replace(alt, "    // Execute transfer (2-step: preview \u2192 submitTransferPin via secure input)\r\n    await assistant.processCustomerMessage('2348012345678', 'Send \u20a65,000 to Mum');\r\n    await assistant.submitTransferPin('2348012345678', '1234'); // secure PIN \u2192 executes transfer");
    console.log('queries new balance: used alt');
  } else {
    console.log('queries new balance: already patched');
  }
}

// 7. "preserves conversation isolation" -> submitTransferPin
const oldIso = "    // Adebayo confirms: must use HIS pending transfer (not Chioma's session)\r\n    // YES \u2192 PIN prompt, then PIN \u2192 success\r\n    const adebayoPinPrompt = await assistant.processCustomerMessage('2348012345678', 'YES');\r\n    expect(adebayoPinPrompt).toContain('PIN');\r\n    const adebayoConfirm = await assistant.processCustomerMessage('2348012345678', '1234');\r\n    expect(adebayoConfirm).toContain('Simulated Transfer Successful!');\r\n    expect(adebayoConfirm).toContain('Jane Adeleke');";
const newIso = "    // Adebayo submits PIN via secure WhatsApp Flow input (uses HIS pending transfer)\r\n    const adebayoConfirm = await assistant.submitTransferPin('2348012345678', '1234');\r\n    expect(adebayoConfirm).toContain('Simulated Transfer Successful!');\r\n    expect(adebayoConfirm).toContain('Jane Adeleke');";

if (!raw.includes(oldIso)) {
  console.error('NOT FOUND: isolation');
  process.exit(1);
}
raw = raw.replace(oldIso, newIso);

fs.writeFileSync(intSpec, raw, 'utf8');
console.log('All integration spec patches applied \u2714');
