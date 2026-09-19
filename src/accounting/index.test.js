'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const path = require('node:path');

const {
  AccountData,
  formatBalance,
  parseAmount,
  processOperation,
} = require('./index');

const applicationPath = path.join(__dirname, 'index.js');

function runApplication(input) {
  const result = spawnSync(process.execPath, [applicationPath], {
    input,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

async function runOperation(operation, enteredAmount) {
  const data = new AccountData();
  const output = [];
  const originalLog = console.log;
  console.log = (message) => output.push(message);

  try {
    await processOperation(operation, data, async () => enteredAmount);
  } finally {
    console.log = originalLog;
  }

  return { balance: data.read(), output: output.join('\n') };
}

test('TC-001: starts with the account menu and default balance', () => {
  const output = runApplication('1\n4\n');

  assert.match(output, /Account Management System/);
  assert.match(output, /1\. View Balance/);
  assert.match(output, /2\. Credit Account/);
  assert.match(output, /3\. Debit Account/);
  assert.match(output, /4\. Exit/);
  assert.match(output, /Current balance: 001000\.00/);
});

test('TC-002: views the current balance', async () => {
  const result = await runOperation('TOTAL');

  assert.equal(result.balance, 100000);
  assert.equal(result.output, 'Current balance: 001000.00');
});

test('TC-003: credits the account with a whole-number amount', async () => {
  const result = await runOperation('CREDIT', '123');

  assert.equal(result.balance, 112300);
  assert.equal(result.output, 'Amount credited. New balance: 001123.00');
});

test('TC-004: credits the account with a decimal amount', async () => {
  const result = await runOperation('CREDIT', '12.34');

  assert.equal(result.balance, 101234);
  assert.equal(result.output, 'Amount credited. New balance: 001012.34');
});

test('TC-005: accepts a zero credit without changing the balance', async () => {
  const result = await runOperation('CREDIT', '0');

  assert.equal(result.balance, 100000);
  assert.equal(result.output, 'Amount credited. New balance: 001000.00');
});

test('TC-006: persists a credit for a later balance read', async () => {
  const data = new AccountData();
  const ask = async () => '50';
  const originalLog = console.log;
  console.log = () => {};

  try {
    await processOperation('CREDIT', data, ask);
    assert.equal(data.read(), 105000);
    assert.equal(formatBalance(data.read()), '001050.00');
  } finally {
    console.log = originalLog;
  }
});

test('TC-007: debits an amount below the current balance', async () => {
  const result = await runOperation('DEBIT', '125');

  assert.equal(result.balance, 87500);
  assert.equal(result.output, 'Amount debited. New balance: 000875.00');
});

test('TC-008: accepts a debit equal to the current balance', async () => {
  const result = await runOperation('DEBIT', '1000');

  assert.equal(result.balance, 0);
  assert.equal(result.output, 'Amount debited. New balance: 000000.00');
});

test('TC-009: rejects a debit greater than the current balance', async () => {
  const result = await runOperation('DEBIT', '1000.01');

  assert.equal(result.balance, 100000);
  assert.equal(result.output, 'Insufficient funds for this debit.');
});

test('TC-010: debits a decimal amount', async () => {
  const result = await runOperation('DEBIT', '12.34');

  assert.equal(result.balance, 98766);
  assert.equal(result.output, 'Amount debited. New balance: 000987.66');
});

test('TC-011: persists a debit for a later balance read', async () => {
  const data = new AccountData();
  const originalLog = console.log;
  console.log = () => {};

  try {
    await processOperation('DEBIT', data, async () => '50');
    assert.equal(data.read(), 95000);
    assert.equal(formatBalance(data.read()), '000950.00');
  } finally {
    console.log = originalLog;
  }
});

test('TC-012: rejects an invalid menu choice and continues', () => {
  const output = runApplication('5\n1\n4\n');

  assert.match(output, /Invalid choice, please select 1-4\./);
  assert.match(output, /Current balance: 001000\.00/);
  assert.match(output, /Exiting the program\. Goodbye!/);
});

test('TC-013: exits the application', () => {
  const output = runApplication('4\n');

  assert.match(output, /Exiting the program\. Goodbye!/);
});

test('TC-014: applies multiple credits and debits in sequence', () => {
  const output = runApplication('2\n200\n3\n75\n1\n4\n');

  assert.match(output, /Amount credited\. New balance: 001200\.00/);
  assert.match(output, /Amount debited\. New balance: 001125\.00/);
  assert.match(output, /Current balance: 001125\.00/);
});

test('TC-015: resets the balance for a new application process', () => {
  runApplication('2\n50\n4\n');
  const output = runApplication('1\n4\n');

  assert.match(output, /Current balance: 001000\.00/);
});

test('TC-016: enforces the supported amount format and boundaries', async () => {
  assert.equal(parseAmount('0'), 0);
  assert.equal(parseAmount('999999.99'), 99999999);
  assert.equal(parseAmount('1000000'), null);
  assert.equal(parseAmount('-1'), null);
  assert.equal(parseAmount('1.234'), null);

  const result = await runOperation('CREDIT', '1000000');
  assert.equal(result.balance, 100000);
  assert.match(result.output, /Invalid amount/);
});