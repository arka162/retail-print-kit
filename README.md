# thermal-print

Receipt printer and cash drawer driver for Node and Electron. ESC/POS and Star command sets,
printer profiles, USB / network / serial transports, no native dependency in the core.

Status: early development. Not published yet.

```js
const { Printer, profiles } = require('thermal-print');
const { NetTransport } = require('thermal-print/net');

const printer = new Printer(new NetTransport('192.168.1.50'), profiles.epsonTmT88);
await printer.open();
printer
  .align('ct').style('b').size(2, 2).text('MY STORE')
  .size(1, 1).style('normal').align('lt')
  .tableCustom([{ text: 'Coffee', align: 'LEFT', width: 0.7 }, { text: '$2.50', align: 'RIGHT', width: 0.3 }])
  .drawLine()
  .feed(2).cut().cashdraw();
await printer.close();
```

Docs: [ADR 0001](docs/adr/0001-replace-escpos.md), [printer matrix](docs/printer-matrix.md).

License: MIT, Arkaprova Majumder.
