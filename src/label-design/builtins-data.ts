import { BuiltinTemplate } from './types';

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    "id": "builtin-2x1-single",
    "name": "2 X 1 — Single",
    "version": 1,
    "kind": "label",
    "builtin": true,
    "size": "2 X 1",
    "layout": "single",
    "priceTypes": [
      "single",
      "credit"
    ],
    "widthMm": 50.8,
    "heightMm": 25.4,
    "dpi": 203,
    "printers": {
      "ezpl": {
        "limits": {
          "itemName": 22,
          "brand": 10
        },
        "header": {
          "q": "25.375",
          "w": "50.75",
          "h": "19",
          "s": "2",
          "addDateTimeTwice": true
        },
        "elements": [
          {
            "type": "barcode",
            "x": 15,
            "y": 142,
            "value": "{{barcode}}",
            "native": "BH,{x},{y},2,2,38,0,1,{value}"
          },
          {
            "type": "text",
            "x": 265,
            "y": 138,
            "value": "{{brand}}",
            "native": "AB,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 19,
            "y": 43,
            "value": "{{unit}}",
            "native": "AB,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 18,
            "y": 14,
            "value": "{{itemName}}",
            "native": "AC,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 265,
            "y": 164,
            "value": "{{reorderId}}",
            "native": "AB,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 102,
            "y": 60,
            "value": "{{price}}",
            "native": "AG,{x},{y},1,1,0,0E,{value}"
          }
        ]
      },
      "zpl": {
        "limits": {
          "itemName": 30,
          "brand": 10
        },
        "header": [
          "^XA",
          "^CI27",
          "^PW406",
          "^LL203",
          "^PR2",
          "^MD18"
        ],
        "elements": [
          {
            "type": "text",
            "x": 18,
            "y": 14,
            "value": "{{itemName}}",
            "native": "^FO{x},{y}^A0N,26,24^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 19,
            "y": 43,
            "value": "{{unit}}",
            "native": "^FO{x},{y}^A0N,20,18^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 92,
            "y": 65,
            "value": "{{price}}",
            "native": "^FO{x},{y}^A0N,85,80^FD{value}^FS"
          },
          {
            "type": "barcode",
            "x": 35,
            "y": 140,
            "value": "{{barcode}}",
            "native": "^FO{x},{y}^BY2^BUN,35,Y,N,Y^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 260,
            "y": 140,
            "value": "{{brand}}",
            "native": "^FO{x},{y}^A0N,26,24^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 260,
            "y": 170,
            "value": "{{reorderId}}",
            "native": "^FO{x},{y}^A0N,26,24^FD{value}^FS"
          }
        ]
      }
    }
  },
  {
    "id": "builtin-2x1-dual",
    "name": "2 X 1 — Dual",
    "version": 1,
    "kind": "label",
    "builtin": true,
    "size": "2 X 1",
    "layout": "dual",
    "priceTypes": [
      "dual"
    ],
    "widthMm": 50.8,
    "heightMm": 25.4,
    "dpi": 203,
    "printers": {
      "ezpl": {
        "limits": {
          "itemName": 22,
          "brand": 10
        },
        "header": {
          "q": "25.375",
          "w": "50.75",
          "h": "19",
          "s": "2",
          "addDateTimeTwice": true
        },
        "elements": [
          {
            "type": "barcode",
            "x": 13,
            "y": 150,
            "value": "{{barcode}}",
            "native": "BH,{x},{y},2,2,30,0,1,{value}"
          },
          {
            "type": "text",
            "x": 263,
            "y": 144,
            "value": "{{brand}}",
            "native": "AB,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 19,
            "y": 41,
            "value": "{{unit}}",
            "native": "AB,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 18,
            "y": 15,
            "value": "{{itemName}}",
            "native": "AC,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 263,
            "y": 169,
            "value": "{{reorderId}}",
            "native": "AB,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 18,
            "y": 90,
            "value": "{{creditPrice}}",
            "native": "AF,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 210,
            "y": 90,
            "value": "{{cashPrice}}",
            "native": "AF,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 39,
            "y": 69,
            "value": "CREDIT PRICE",
            "native": "AB,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 228,
            "y": 68,
            "value": "CASH PRICE",
            "native": "AB,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 39,
            "y": 68,
            "value": "CREDIT PRICE",
            "native": "AB,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 228,
            "y": 67,
            "value": "CASH PRICE",
            "native": "AB,{x},{y},1,1,0,0E,{value}"
          }
        ]
      },
      "zpl": {
        "limits": {
          "itemName": 30,
          "brand": 12
        },
        "header": [
          "^XA",
          "^CI27",
          "^PW406",
          "^LL203",
          "^PR2",
          "^MD18"
        ],
        "elements": [
          {
            "type": "text",
            "x": 18,
            "y": 15,
            "value": "{{itemName}}",
            "native": "^FO{x},{y}^A0N,28,24^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 18,
            "y": 41,
            "value": "{{unit}}",
            "native": "^FO{x},{y}^A0N,18,16^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 18,
            "y": 65,
            "value": "CREDIT PRICE",
            "native": "^FO{x},{y}^A0N,22,20^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 210,
            "y": 65,
            "value": "CASH PRICE",
            "native": "^FO{x},{y}^A0N,22,20^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 18,
            "y": 94,
            "value": "{{creditPrice}}",
            "native": "^FO{x},{y}^A0N,50,47^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 210,
            "y": 94,
            "value": "{{cashPrice}}",
            "native": "^FO{x},{y}^A0N,50,47^FD{value}^FS"
          },
          {
            "type": "barcode",
            "x": 32,
            "y": 145,
            "value": "{{barcode}}",
            "native": "^FO{x},{y}^BY2^BUN,30,Y,N,Y^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 258,
            "y": 145,
            "value": "{{brand}}",
            "native": "^FO{x},{y}^A0N,24,22^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 258,
            "y": 174,
            "value": "{{reorderId}}",
            "native": "^FO{x},{y}^A0N,24,22^FD{value}^FS"
          }
        ]
      }
    }
  },
  {
    "id": "builtin-2.25x1.25-single",
    "name": "2.25 X 1.25 — Single",
    "version": 1,
    "kind": "label",
    "builtin": true,
    "size": "2.25 X 1.25",
    "layout": "single",
    "priceTypes": [
      "single",
      "credit"
    ],
    "widthMm": 57.15,
    "heightMm": 31.75,
    "dpi": 203,
    "printers": {
      "ezpl": {
        "limits": {
          "itemName": 18,
          "brand": 10
        },
        "header": {
          "q": "31.75",
          "w": "57.125",
          "h": "8",
          "s": "3",
          "addDateTimeTwice": true
        },
        "elements": [
          {
            "type": "barcode",
            "x": 14,
            "y": 190,
            "value": "{{barcode}}",
            "native": "BH,{x},{y},2,2,38,0,1,{value}"
          },
          {
            "type": "text",
            "x": 270,
            "y": 185,
            "value": "{{brand}}",
            "native": "AC,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 18,
            "y": 55,
            "value": "{{unit}}",
            "native": "AC,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 17,
            "y": 17,
            "value": "{{itemName}}",
            "native": "AD,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 270,
            "y": 216,
            "value": "{{reorderId}}",
            "native": "AB,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 124,
            "y": 90,
            "value": "{{price}}",
            "native": "AG,{x},{y},1,1,0,0E,{value}"
          }
        ]
      },
      "zpl": {
        "limits": {
          "itemName": 34,
          "brand": 15
        },
        "header": [
          "^XA",
          "^CI27",
          "^PW457",
          "^LL254",
          "^PR3",
          "^MD18"
        ],
        "elements": [
          {
            "type": "text",
            "x": 17,
            "y": 17,
            "value": "{{itemName}}",
            "native": "^FO{x},{y}^A0N,30,25^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 18,
            "y": 55,
            "value": "{{unit}}",
            "native": "^FO{x},{y}^A0N,25,20^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 114,
            "y": 85,
            "value": "{{price}}",
            "native": "^FO{x},{y}^A0N,90,85^FD{value}^FS"
          },
          {
            "type": "barcode",
            "x": 35,
            "y": 180,
            "value": "{{barcode}}",
            "native": "^FO{x},{y}^BY2^BUN,35,Y,N,Y^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 278,
            "y": 180,
            "value": "{{brand}}",
            "native": "^FO{x},{y}^A0N,27,22^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 278,
            "y": 215,
            "value": "{{reorderId}}",
            "native": "^FO{x},{y}^A0N,24,22^FD{value}^FS"
          }
        ]
      }
    }
  },
  {
    "id": "builtin-2.25x1.25-dual",
    "name": "2.25 X 1.25 — Dual",
    "version": 1,
    "kind": "label",
    "builtin": true,
    "size": "2.25 X 1.25",
    "layout": "dual",
    "priceTypes": [
      "dual"
    ],
    "widthMm": 57.15,
    "heightMm": 31.75,
    "dpi": 203,
    "printers": {
      "ezpl": {
        "limits": {
          "itemName": 20,
          "brand": 14
        },
        "header": {
          "q": "31.75",
          "w": "57.125",
          "h": "19",
          "s": "2",
          "addDateTimeTwice": true
        },
        "elements": [
          {
            "type": "barcode",
            "x": 18,
            "y": 189,
            "value": "{{barcode}}",
            "native": "BH,{x},{y},2,2,38,0,1,{value}"
          },
          {
            "type": "text",
            "x": 262,
            "y": 187,
            "value": "{{brand}}",
            "native": "AB,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 18,
            "y": 62,
            "value": "{{unit}}",
            "native": "AB,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 18,
            "y": 19,
            "value": "{{itemName}}",
            "native": "AD,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 262,
            "y": 216,
            "value": "{{reorderId}}",
            "native": "AB,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 25,
            "y": 122,
            "value": "{{creditPrice}}",
            "native": "AF,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 256,
            "y": 122,
            "value": "{{cashPrice}}",
            "native": "AF,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 28,
            "y": 95,
            "value": "CREDIT PRICE",
            "native": "AC,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 260,
            "y": 95,
            "value": "CASH PRICE",
            "native": "AC,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 28,
            "y": 94,
            "value": "CREDIT PRICE",
            "native": "AC,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 260,
            "y": 94,
            "value": "CASH PRICE",
            "native": "AC,{x},{y},1,1,0,0E,{value}"
          }
        ]
      },
      "zpl": {
        "limits": {
          "itemName": 33,
          "brand": 16
        },
        "header": [
          "^XA",
          "^CI27",
          "^PW457",
          "^LL254",
          "^PR2",
          "^MD18"
        ],
        "elements": [
          {
            "type": "text",
            "x": 18,
            "y": 19,
            "value": "{{itemName}}",
            "native": "^FO{x},{y}^A0N,30,25^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 18,
            "y": 52,
            "value": "{{unit}}",
            "native": "^FO{x},{y}^A0N,22,18^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 25,
            "y": 83,
            "value": "CREDIT PRICE",
            "native": "^FO{x},{y}^A0N,24,22^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 255,
            "y": 83,
            "value": "CASH PRICE",
            "native": "^FO{x},{y}^A0N,24,22^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 25,
            "y": 113,
            "value": "{{creditPrice}}",
            "native": "^FO{x},{y}^A0N,62,59^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 255,
            "y": 113,
            "value": "{{cashPrice}}",
            "native": "^FO{x},{y}^A0N,62,59^FD{value}^FS"
          },
          {
            "type": "barcode",
            "x": 35,
            "y": 180,
            "value": "{{barcode}}",
            "native": "^FO{x},{y}^BY2^BUN,35,Y,N,Y^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 280,
            "y": 180,
            "value": "{{brand}}",
            "native": "^FO{x},{y}^A0N,27,22^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 280,
            "y": 212,
            "value": "{{reorderId}}",
            "native": "^FO{x},{y}^A0N,24,22^FD{value}^FS"
          }
        ]
      }
    }
  },
  {
    "id": "builtin-2.5x1-single",
    "name": "2.5 X 1 — Single",
    "version": 1,
    "kind": "label",
    "builtin": true,
    "size": "2.5 X 1",
    "layout": "single",
    "priceTypes": [
      "single",
      "credit"
    ],
    "widthMm": 63.5,
    "heightMm": 25.4,
    "dpi": 203,
    "printers": {
      "ezpl": {
        "limits": {
          "itemName": 22,
          "brand": 18
        },
        "header": {
          "q": "25.375",
          "w": "63.5",
          "h": "19",
          "s": "2",
          "addDateTimeTwice": false
        },
        "elements": [
          {
            "type": "barcode",
            "x": 13,
            "y": 144,
            "value": "{{barcode}}",
            "native": "BH,{x},{y},2,3,38,0,1,{value}"
          },
          {
            "type": "text",
            "x": 250,
            "y": 138,
            "value": "{{brand}}",
            "native": "AB,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 13,
            "y": 49,
            "value": "{{unit}}",
            "native": "AC,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 13,
            "y": 14,
            "value": "{{itemName}}",
            "native": "AD,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 126,
            "y": 60,
            "value": "{{price}}",
            "native": "AG,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 250,
            "y": 166,
            "value": "{{reorderId}}",
            "native": "AB,{x},{y},1,1,0,0E,{value}"
          }
        ]
      },
      "zpl": {
        "limits": {
          "itemName": 35,
          "brand": 14
        },
        "header": [
          "^XA",
          "^CI27",
          "^PW508",
          "^LL203",
          "^PR2",
          "^MD18"
        ],
        "elements": [
          {
            "type": "text",
            "x": 13,
            "y": 14,
            "value": "{{itemName}}",
            "native": "^FO{x},{y}^A0N,30,25^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 13,
            "y": 49,
            "value": "{{unit}}",
            "native": "^FO{x},{y}^A0N,25,20^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 136,
            "y": 75,
            "value": "{{price}}",
            "native": "^FO{x},{y}^A0N,80,75^FD{value}^FS"
          },
          {
            "type": "barcode",
            "x": 32,
            "y": 145,
            "value": "{{barcode}}",
            "native": "^FO{x},{y}^BY2,3^BUN,30,Y,N,Y^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 280,
            "y": 145,
            "value": "{{brand}}",
            "native": "^FO{x},{y}^A0N,22,20^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 280,
            "y": 170,
            "value": "{{reorderId}}",
            "native": "^FO{x},{y}^A0N,22,20^FD{value}^FS"
          }
        ]
      }
    }
  },
  {
    "id": "builtin-2.5x1-dual",
    "name": "2.5 X 1 — Dual",
    "version": 1,
    "kind": "label",
    "builtin": true,
    "size": "2.5 X 1",
    "layout": "dual",
    "priceTypes": [
      "dual"
    ],
    "widthMm": 63.5,
    "heightMm": 25.4,
    "dpi": 203,
    "printers": {
      "ezpl": {
        "limits": {
          "itemName": 28,
          "brand": 18
        },
        "header": {
          "q": "25.375",
          "w": "63.5",
          "h": "19",
          "s": "2",
          "addDateTimeTwice": true
        },
        "elements": [
          {
            "type": "barcode",
            "x": 16,
            "y": 142,
            "value": "{{barcode}}",
            "native": "BH,{x},{y},2,2,38,0,1,{value}"
          },
          {
            "type": "text",
            "x": 10,
            "y": 14,
            "value": "{{itemName}}",
            "native": "AC,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 10,
            "y": 44,
            "value": "{{unit}}",
            "native": "AB,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 266,
            "y": 144,
            "value": "{{brand}}",
            "native": "AB,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 266,
            "y": 170,
            "value": "{{reorderId}}",
            "native": "AB,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 38,
            "y": 89,
            "value": "{{creditPrice}}",
            "native": "AF,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 276,
            "y": 89,
            "value": "{{cashPrice}}",
            "native": "AF,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 38,
            "y": 68,
            "value": "CREDIT PRICE",
            "native": "AC,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 276,
            "y": 68,
            "value": "CASH PRICE",
            "native": "AC,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 277,
            "y": 68,
            "value": "CASH PRICE",
            "native": "AC,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 39,
            "y": 68,
            "value": "CREDIT PRICE",
            "native": "AC,{x},{y},1,1,0,0E,{value}"
          }
        ]
      },
      "zpl": {
        "limits": {
          "itemName": 28,
          "brand": 20
        },
        "header": [
          "^XA",
          "^CI27",
          "^PW508",
          "^LL203",
          "^PR2",
          "^MD18"
        ],
        "elements": [
          {
            "type": "text",
            "x": 20,
            "y": 14,
            "value": "{{itemName}}",
            "native": "^FO{x},{y}^A0N,32,30^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 20,
            "y": 44,
            "value": "{{unit}}",
            "native": "^FO{x},{y}^A0N,20,24^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 20,
            "y": 68,
            "value": "CREDIT PRICE",
            "native": "^FO{x},{y}^A0N,22,18^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 20,
            "y": 94,
            "value": "{{creditPrice}}",
            "native": "^FO{x},{y}^A0N,54,52^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 280,
            "y": 68,
            "value": "CASH PRICE",
            "native": "^FO{x},{y}^A0N,22,18^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 280,
            "y": 94,
            "value": "{{cashPrice}}",
            "native": "^FO{x},{y}^A0N,54,52^FD{value}^FS"
          },
          {
            "type": "barcode",
            "x": 40,
            "y": 148,
            "value": "{{barcode}}",
            "native": "^FO{x},{y}^BY2^BUN,22,Y,N,Y^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 280,
            "y": 148,
            "value": "{{brand}}",
            "native": "^FO{x},{y}^A0N,20,18^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 280,
            "y": 173,
            "value": "{{reorderId}}",
            "native": "^FO{x},{y}^A0N,20,18^FD{value}^FS"
          }
        ]
      }
    }
  },
  {
    "id": "builtin-1.25x1-single",
    "name": "1.25 X 1 — Single",
    "version": 1,
    "kind": "label",
    "builtin": true,
    "size": "1.25 X 1",
    "layout": "single",
    "priceTypes": [
      "single",
      "credit"
    ],
    "widthMm": 31.75,
    "heightMm": 25.4,
    "dpi": 203,
    "printers": {
      "ezpl": {
        "limits": {
          "itemName": 12,
          "brand": 0
        },
        "header": {
          "q": "25.4",
          "w": "31.75",
          "h": "19",
          "s": "2",
          "includeDateTimeLines": false
        },
        "elements": [
          {
            "type": "text",
            "x": 6,
            "y": 10,
            "value": "{{itemName}}",
            "native": "AD,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 6,
            "y": 11,
            "value": "{{itemName}}",
            "native": "AD,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 6,
            "y": 48,
            "value": "{{unit}}",
            "native": "AA,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 6,
            "y": 49,
            "value": "{{unit}}",
            "native": "AA,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 40,
            "y": 63,
            "value": "{{price}}",
            "native": "AF,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "barcode",
            "x": 8,
            "y": 126,
            "value": "{{barcode}}",
            "native": "BH,{x},{y},2,2,40,0,1,{value}"
          }
        ]
      },
      "zpl": {
        "limits": {
          "itemName": 16,
          "brand": 0
        },
        "header": [
          "^XA",
          "^CI27",
          "^PW254",
          "^LL203",
          "^PR2",
          "^MD18"
        ],
        "elements": [
          {
            "type": "text",
            "x": 14,
            "y": 23,
            "value": "{{itemName}}",
            "native": "^FO{x},{y}^A0N,36,28^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 14,
            "y": 56,
            "value": "{{unit}}",
            "native": "^FO{x},{y}^A0N,20,18^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 40,
            "y": 80,
            "value": "{{price}}",
            "native": "^FO{x},{y}^A0N,60,50^FD{value}^FS"
          },
          {
            "type": "barcode",
            "x": 28,
            "y": 138,
            "value": "{{barcode}}",
            "native": "^FO{x},{y}^BY2^BUN,34,Y,N,Y^FD{value}^FS"
          }
        ]
      }
    }
  },
  {
    "id": "builtin-1.25x1-dual",
    "name": "1.25 X 1 — Dual",
    "version": 1,
    "kind": "label",
    "builtin": true,
    "size": "1.25 X 1",
    "layout": "dual",
    "priceTypes": [
      "dual"
    ],
    "widthMm": 31.75,
    "heightMm": 25.4,
    "dpi": 203,
    "printers": {
      "ezpl": {
        "limits": {
          "itemName": 12,
          "brand": 0
        },
        "header": {
          "q": "25.4",
          "w": "31.75",
          "h": "19",
          "s": "2",
          "addDateTimeTwice": true
        },
        "elements": [
          {
            "type": "barcode",
            "x": 10,
            "y": 135,
            "value": "{{barcode}}",
            "native": "BH,{x},{y},2,2,38,0,1,{value}"
          },
          {
            "type": "text",
            "x": 8,
            "y": 37,
            "value": "{{unit}}",
            "native": "AA,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 8,
            "y": 2,
            "value": "{{itemName}}",
            "native": "AA,{x},{y},2,2,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 12,
            "y": 96,
            "value": "{{creditPrice}}",
            "native": "AC,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 8,
            "y": 3,
            "value": "{{itemName}}",
            "native": "AA,{x},{y},2,2,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 9,
            "y": 36,
            "value": "{{unit}}",
            "native": "AA,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 132,
            "y": 96,
            "value": "{{cashPrice}}",
            "native": "AC,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 136,
            "y": 70,
            "value": "Cash Price",
            "native": "AA,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 14,
            "y": 70,
            "value": "Credit Price",
            "native": "AA,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 14,
            "y": 71,
            "value": "Credit Price",
            "native": "AA,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 136,
            "y": 71,
            "value": "Cash Price",
            "native": "AA,{x},{y},1,1,0,0E,{value}"
          }
        ]
      },
      "zpl": {
        "limits": {
          "itemName": 16,
          "brand": 0
        },
        "header": [
          "^XA",
          "^PW254",
          "^LL203",
          "^MD25",
          "^PR2"
        ],
        "elements": [
          {
            "type": "text",
            "x": 6,
            "y": 20,
            "value": "{{itemName}}",
            "native": "^FO{x},{y}^A0N,28,26^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 6,
            "y": 48,
            "value": "{{unit}}",
            "native": "^FO{x},{y}^A0N,20,18^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 6,
            "y": 72,
            "value": "Credit Price",
            "native": "^FO{x},{y}^A0N,22,20^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 128,
            "y": 72,
            "value": "Cash Price",
            "native": "^FO{x},{y}^A0N,22,20^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 6,
            "y": 98,
            "value": "{{creditPrice}}",
            "native": "^FO{x},{y}^A0N,38,36^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 128,
            "y": 98,
            "value": "{{cashPrice}}",
            "native": "^FO{x},{y}^A0N,38,36^FD{value}^FS"
          },
          {
            "type": "barcode",
            "x": 28,
            "y": 142,
            "value": "{{barcode}}",
            "native": "^BY2,2,40^FO{x},{y}^BUN,40,Y,N,N^FD{value}^FS"
          }
        ]
      }
    }
  },
  {
    "id": "builtin-1.2x0.85-single",
    "name": "1.2 X 0.85 — Single",
    "version": 1,
    "kind": "label",
    "builtin": true,
    "size": "1.2 X 0.85",
    "layout": "single",
    "priceTypes": [
      "single",
      "credit"
    ],
    "widthMm": 30.48,
    "heightMm": 21.59,
    "dpi": 203,
    "printers": {
      "ezpl": {
        "limits": {
          "itemName": 22,
          "brand": 0
        },
        "header": {
          "q": "21.625",
          "w": "30.5",
          "h": "19",
          "s": "2",
          "addDateTimeTwice": true
        },
        "elements": [
          {
            "type": "barcode",
            "x": 10,
            "y": 110,
            "value": "{{barcode}}",
            "native": "BH,{x},{y},2,2,38,0,1,{value}"
          },
          {
            "type": "text",
            "x": 13,
            "y": 35,
            "value": "{{unit}}",
            "native": "AA,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 13,
            "y": 13,
            "value": "{{itemName}}",
            "native": "AA,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 32,
            "y": 50,
            "value": "{{price}}",
            "native": "AF,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 14,
            "y": 13,
            "value": "{{itemName}}",
            "native": "AA,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 13,
            "y": 34,
            "value": "{{unit}}",
            "native": "AA,{x},{y},1,1,0,0E,{value}"
          }
        ]
      },
      "zpl": {
        "limits": {
          "itemName": 16,
          "brand": 0
        },
        "header": [
          "^XA",
          "^PW244",
          "^LL172",
          "^MD25",
          "^PR2",
          "^LH0,0"
        ],
        "elements": [
          {
            "type": "text",
            "x": 15,
            "y": 15,
            "value": "{{itemName}}",
            "native": "^FO{x},{y}^A0N,20,20^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 15,
            "y": 40,
            "value": "{{unit}}",
            "native": "^FO{x},{y}^A0N,20,20^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 32,
            "y": 65,
            "value": "{{price}}",
            "native": "^FO{x},{y}^A0N,45,45^FD{value}^FS"
          },
          {
            "type": "barcode",
            "x": 28,
            "y": 115,
            "value": "{{barcode}}",
            "native": "^BY2,2,40^FO{x},{y}^BUN,40,Y,N,N^FD{value}^FS"
          }
        ]
      }
    }
  },
  {
    "id": "builtin-1.2x0.85-dual",
    "name": "1.2 X 0.85 — Dual",
    "version": 1,
    "kind": "label",
    "builtin": true,
    "size": "1.2 X 0.85",
    "layout": "dual",
    "priceTypes": [
      "dual"
    ],
    "widthMm": 30.48,
    "heightMm": 21.59,
    "dpi": 203,
    "printers": {
      "ezpl": {
        "limits": {
          "itemName": 22,
          "brand": 0
        },
        "header": {
          "q": "21.625",
          "w": "30.5",
          "h": "19",
          "s": "2",
          "addDateTimeTwice": true
        },
        "elements": [
          {
            "type": "barcode",
            "x": 10,
            "y": 110,
            "value": "{{barcode}}",
            "native": "BH,{x},{y},2,2,38,0,1,{value}"
          },
          {
            "type": "text",
            "x": 13,
            "y": 35,
            "value": "{{unit}}",
            "native": "AA,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 13,
            "y": 13,
            "value": "{{itemName}}",
            "native": "AA,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 12,
            "y": 78,
            "value": "{{creditPrice}}",
            "native": "AC,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 14,
            "y": 13,
            "value": "{{itemName}}",
            "native": "AA,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 13,
            "y": 34,
            "value": "{{unit}}",
            "native": "AA,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 132,
            "y": 78,
            "value": "{{cashPrice}}",
            "native": "AC,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 136,
            "y": 60,
            "value": "Cash Price",
            "native": "AA,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 14,
            "y": 60,
            "value": "Credit Price",
            "native": "AA,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 14,
            "y": 61,
            "value": "Credit Price",
            "native": "AA,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 136,
            "y": 61,
            "value": "Cash Price",
            "native": "AA,{x},{y},1,1,0,0E,{value}"
          }
        ]
      },
      "zpl": {
        "limits": {
          "itemName": 16,
          "brand": 0
        },
        "header": [
          "^XA",
          "^PW244",
          "^LL172",
          "^MD25",
          "^PR2"
        ],
        "elements": [
          {
            "type": "text",
            "x": 13,
            "y": 15,
            "value": "{{itemName}}",
            "native": "^FO{x},{y}^A0N,22,20^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 13,
            "y": 38,
            "value": "{{unit}}",
            "native": "^FO{x},{y}^A0N,18,16^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 13,
            "y": 60,
            "value": "Credit Price",
            "native": "^FO{x},{y}^A0N,22,20^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 132,
            "y": 60,
            "value": "Cash Price",
            "native": "^FO{x},{y}^A0N,22,20^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 13,
            "y": 84,
            "value": "{{creditPrice}}",
            "native": "^FO{x},{y}^A0N,32,30^FD{value}^FS"
          },
          {
            "type": "text",
            "x": 132,
            "y": 84,
            "value": "{{cashPrice}}",
            "native": "^FO{x},{y}^A0N,32,30^FD{value}^FS"
          },
          {
            "type": "barcode",
            "x": 24,
            "y": 115,
            "value": "{{barcode}}",
            "native": "^BY2,2,35^FO{x},{y}^BUN,35,Y,N,N^FD{value}^FS"
          }
        ]
      }
    }
  },
  {
    "id": "builtin-3.5x1.25-single",
    "name": "3.5 X 1.25 — Single",
    "version": 1,
    "kind": "label",
    "builtin": true,
    "size": "3.5 X 1.25",
    "layout": "single",
    "priceTypes": [
      "single",
      "credit"
    ],
    "widthMm": 88.9,
    "heightMm": 31.75,
    "dpi": 203,
    "printers": {
      "ezpl": {
        "limits": {
          "itemName": 24,
          "brand": 13
        },
        "header": {
          "q": "31.75",
          "w": "88.9",
          "h": "8",
          "s": "3",
          "addDateTimeTwice": true
        },
        "elements": [
          {
            "type": "text",
            "x": 64,
            "y": 22,
            "value": "{{itemName}}",
            "native": "AE,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 65,
            "y": 22,
            "value": "{{itemName}}",
            "native": "AE,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 64,
            "y": 68,
            "value": "{{brand}}",
            "native": "AD,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "text",
            "x": 64,
            "y": 102,
            "value": "{{unit}}",
            "native": "AD,{x},{y},1,1,0,0E,{value}"
          },
          {
            "type": "barcode",
            "x": 64,
            "y": 142,
            "value": "{{barcode}}",
            "native": "BH,{x},{y},2,2,64,0,1,{value}"
          },
          {
            "type": "text",
            "fit": {
              "left": 425,
              "right": 708,
              "middle": 154,
              "size": 85
            },
            "value": "{{price}}",
            "native": "AT,{x},{y},{size},{size},0,0B,0,0,{value}"
          }
        ]
      }
    }
  }
];
