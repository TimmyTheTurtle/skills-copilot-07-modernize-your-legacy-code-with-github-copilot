'use strict';

const readline = require('node:readline');

const INITIAL_BALANCE_CENTS = 100000;
const MAX_BALANCE_CENTS = 99999999;

class AccountData {
  constructor() {
    this.storageBalance = INITIAL_BALANCE_CENTS;
  }

  read() {
    return this.storageBalance;
  }

  write(balance) {
    if (!Number.isInteger(balance) || balance < 0 || balance > MAX_BALANCE_CENTS) {
      throw new RangeError('Balance is outside the supported account range.');
    }

    this.storageBalance = balance;
  }
}

function formatBalance(balanceCents) {
  const wholeUnits = Math.floor(balanceCents / 100).toString().padStart(6, '0');
  const cents = (balanceCents % 100).toString().padStart(2, '0');
  return `${wholeUnits}.${cents}`;
}

function parseAmount(input) {
  const value = input.trim();

  if (!/^\d{1,6}(?:\.\d{1,2})?$/.test(value)) {
    return null;
  }

  const [wholeUnits, fractionalUnits = ''] = value.split('.');
  const amount = Number(wholeUnits) * 100 + Number(fractionalUnits.padEnd(2, '0'));

  return amount <= MAX_BALANCE_CENTS ? amount : null;
}

async function processOperation(operation, data, ask) {
  if (operation === 'TOTAL') {
    console.log(`Current balance: ${formatBalance(data.read())}`);
    return;
  }

  if (operation === 'CREDIT' || operation === 'DEBIT') {
    const action = operation === 'CREDIT' ? 'credit' : 'debit';
    const enteredAmount = await ask(`Enter ${action} amount: `);

    if (enteredAmount === null) {
      return;
    }

    const amount = parseAmount(enteredAmount);

    if (amount === null) {
      console.log('Invalid amount, please enter a non-negative amount with up to two decimal places.');
      return;
    }

    const currentBalance = data.read();

    if (operation === 'DEBIT' && currentBalance < amount) {
      console.log('Insufficient funds for this debit.');
      return;
    }

    const newBalance = operation === 'CREDIT'
      ? currentBalance + amount
      : currentBalance - amount;

    data.write(newBalance);
    const result = operation === 'CREDIT' ? 'credited' : 'debited';
    console.log(`Amount ${result}. New balance: ${formatBalance(newBalance)}`);
  }
}

async function run() {
  const terminal = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const inputLines = terminal[Symbol.asyncIterator]();
  const ask = async (prompt) => {
    process.stdout.write(prompt);
    const nextLine = await inputLines.next();
    return nextLine.done ? null : nextLine.value;
  };
  const data = new AccountData();

  try {
    let continueRunning = true;

    while (continueRunning) {
      console.log('--------------------------------');
      console.log('Account Management System');
      console.log('1. View Balance');
      console.log('2. Credit Account');
      console.log('3. Debit Account');
      console.log('4. Exit');
      console.log('--------------------------------');

      const choice = await ask('Enter your choice (1-4): ');

      if (choice === null) {
        continueRunning = false;
        break;
      }

      switch (choice.trim()) {
        case '1':
          await processOperation('TOTAL', data, ask);
          break;
        case '2':
          await processOperation('CREDIT', data, ask);
          break;
        case '3':
          await processOperation('DEBIT', data, ask);
          break;
        case '4':
          continueRunning = false;
          break;
        default:
          console.log('Invalid choice, please select 1-4.');
      }
    }

    console.log('Exiting the program. Goodbye!');
  } finally {
    terminal.close();
  }
}

if (require.main === module) {
  run();
}

module.exports = {
  AccountData,
  formatBalance,
  parseAmount,
  processOperation,
  run,
};