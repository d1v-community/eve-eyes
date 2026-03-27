import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildUserActivityRecordsForTransactionBlock,
} from '../../indexer/src/user-activity-records.mjs'

const PACKAGE_ID =
  '0xd12a70c74c1e759445d6f209b01d43d860e97fcf2ef72ccbbd00afd828043f75'

test('buildUserActivityRecordsForTransactionBlock derives event and move-call activities', () => {
  const records = buildUserActivityRecordsForTransactionBlock(
    {
      digest: '4ZDyQjiojQQmvhpZurSyj9gT6HQoJyKYbKK1FbZKHHqY',
      transaction_time: '2026-03-25T13:10:18.113Z',
      raw_content: {
        events: [
          {
            id: {
              txDigest: '4ZDyQjiojQQmvhpZurSyj9gT6HQoJyKYbKK1FbZKHHqY',
              eventSeq: '0',
            },
            type: `${PACKAGE_ID}::character::CharacterCreatedEvent`,
            parsedJson: {
              key: {
                item_id: '2112000175',
                tenant: 'utopia',
              },
              character_id:
                '0xe1c4cd5eb84c8c4daa3d28a92efbbaa635b6982fc3a68cafa29df947a7295969',
              character_address:
                '0x878f69675663279773b986f222152098929532b74c1b01e357d4a9b303c48b56',
            },
          },
        ],
        transaction: {
          data: {
            transaction: {
              transactions: [
                {
                  MoveCall: {
                    package: PACKAGE_ID,
                    module: 'storage_unit',
                    function: 'deposit_by_owner',
                    arguments: [
                      { Input: 0 },
                      { Input: 1 },
                    ],
                  },
                },
              ],
              inputs: [
                {
                  type: 'object',
                  objectId:
                    '0x1111111111111111111111111111111111111111111111111111111111111111',
                },
                {
                  type: 'object',
                  objectId:
                    '0x2222222222222222222222222222222222222222222222222222222222222222',
                },
              ],
            },
          },
        },
      },
      events: [
        {
          id: {
            txDigest: '4ZDyQjiojQQmvhpZurSyj9gT6HQoJyKYbKK1FbZKHHqY',
            eventSeq: '0',
          },
          type: `${PACKAGE_ID}::character::CharacterCreatedEvent`,
          parsedJson: {
            key: {
              item_id: '2112000175',
              tenant: 'utopia',
            },
            character_id:
              '0xe1c4cd5eb84c8c4daa3d28a92efbbaa635b6982fc3a68cafa29df947a7295969',
            character_address:
              '0x878f69675663279773b986f222152098929532b74c1b01e357d4a9b303c48b56',
          },
        },
      ],
    },
    PACKAGE_ID
  )

  assert.equal(records.length, 2)
  assert.equal(records[0].activityType, 'character_created')
  assert.equal(records[0].participants[0].walletAddress, '0x878f69675663279773b986f222152098929532b74c1b01e357d4a9b303c48b56')
  assert.equal(records[1].activityType, 'deposit_by_owner')
  assert.equal(records[1].sourceKind, 'move_call')
})

test('buildUserActivityRecordsForTransactionBlock skips duplicate move-call activity when matching event exists', () => {
  const records = buildUserActivityRecordsForTransactionBlock(
    {
      digest: 'digest-1',
      transaction_time: '2026-03-25T13:10:18.113Z',
      raw_content: {
        events: [
          {
            id: { txDigest: 'digest-1', eventSeq: '0' },
            type: `${PACKAGE_ID}::world::JumpEvent`,
            parsedJson: {
              character_id:
                '0x93a582616321ac92a4baf4923214af1302e4482818a543796b744e78e80f5ec7',
              source_gate_id:
                '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
              destination_gate_id:
                '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            },
          },
        ],
        transaction: {
          data: {
            transaction: {
              transactions: [
                {
                  MoveCall: {
                    package: PACKAGE_ID,
                    module: 'world',
                    function: 'jump',
                    arguments: [],
                  },
                },
              ],
              inputs: [],
            },
          },
        },
      },
      events: [
        {
          id: { txDigest: 'digest-1', eventSeq: '0' },
          type: `${PACKAGE_ID}::world::JumpEvent`,
          parsedJson: {
            character_id:
              '0x93a582616321ac92a4baf4923214af1302e4482818a543796b744e78e80f5ec7',
            source_gate_id:
              '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            destination_gate_id:
              '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          },
        },
      ],
    },
    PACKAGE_ID
  )

  assert.equal(records.length, 1)
  assert.equal(records[0].activityType, 'jump')
  assert.equal(records[0].sourceKind, 'event')
  assert.equal(records[0].participants.length, 3)
  assert.equal(records[0].participants[1]?.role, 'source_gate')
  assert.equal(
    records[0].participants[2]?.characterObjectId,
    '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
  )
})

test('buildUserActivityRecordsForTransactionBlock keeps event sender as wallet participant for generic events', () => {
  const sender =
    '0x7a98a2a5c810258b5bb469f3a15888b8e4ea4faa79b0d558cc397d3de1b998fb'

  const records = buildUserActivityRecordsForTransactionBlock(
    {
      digest: 'digest-2',
      transaction_time: '2026-03-18T04:10:55.332Z',
      raw_content: {
        transaction: {
          data: {
            transaction: {
              transactions: [],
              inputs: [],
            },
          },
        },
      },
      events: [
        {
          id: { txDigest: 'digest-2', eventSeq: '0' },
          type: `${PACKAGE_ID}::fuel::FuelEvent`,
          sender,
          parsedJson: {
            action: { variant: 'DEPOSITED', fields: {} },
            assembly_id:
              '0x2c2961241948777514d36f74891423cee4fc86b4e8755153a15482e4ab299784',
            assembly_key: {
              tenant: 'utopia',
              item_id: '1000000017078',
            },
            new_quantity: '100',
            old_quantity: '0',
          },
        },
      ],
    },
    PACKAGE_ID
  )

  assert.equal(records.length, 1)
  assert.equal(records[0].activityType, 'fuel')
  assert.equal(records[0].participants.length, 2)
  assert.equal(records[0].participants[0]?.role, 'assembly')
  assert.equal(records[0].participants[1]?.role, 'sender')
  assert.equal(records[0].participants[1]?.walletAddress, sender)
})
