import test from 'node:test'
import assert from 'node:assert/strict'
import {
  fetchCharacterIdentityFromChange,
  fetchBuildingSnapshot,
  normalizePastObjectVersion,
} from '../../indexer/src/derived-record-sync.mjs'

const PACKAGE_ID =
  '0xd12a70c74c1e759445d6f209b01d43d860e97fcf2ef72ccbbd00afd828043f75'

function createBuildingObjectResponse() {
  return {
    data: {
      objectId:
        '0xc70871445ebfe8e11483d29f5cc56596a786289b10f4a62077d80f1a05bed277',
      type: `${PACKAGE_ID}::network_node::NetworkNode`,
      content: {
        fields: {
          id: {
            id: '0xc70871445ebfe8e11483d29f5cc56596a786289b10f4a62077d80f1a05bed277',
          },
          key: {
            fields: {
              item_id: '1000000019867',
              tenant: 'utopia',
            },
          },
          owner_cap_id:
            '0x799de410ceb035cb171a24fdb3168669beaca9d4e956ccac18a34b90a417c78b',
          type_id: '88092',
          status: {
            fields: {
              status: {
                variant: 'OFFLINE',
                fields: {},
              },
            },
          },
        },
      },
    },
  }
}

function createCharacterObjectResponse() {
  return {
    data: {
      objectId:
        '0x3e45062d6928cbc472c9006a1adc605872ac2e5a7877018d6d7816d9a326d426',
      version: '807978009',
      type: `${PACKAGE_ID}::character::Character`,
      content: {
        fields: {
          id: {
            id: '0x3e45062d6928cbc472c9006a1adc605872ac2e5a7877018d6d7816d9a326d426',
          },
          character_address:
            '0xc9aab3eebb8942bba72e5579d4a63c35d72c693a138e29e08b6732653715be54',
          key: {
            fields: {
              item_id: '2112000244',
              tenant: 'utopia',
            },
          },
        },
      },
    },
  }
}

test('normalizePastObjectVersion converts numeric strings into safe integers', () => {
  assert.equal(normalizePastObjectVersion('807978009'), 807978009)
  assert.equal(normalizePastObjectVersion(807978009), 807978009)
  assert.equal(normalizePastObjectVersion(' 807978009 '), 807978009)
  assert.equal(normalizePastObjectVersion('bad-version'), null)
})

test('fetchBuildingSnapshot sends a numeric version to tryGetPastObject', async () => {
  const rpcUsage = []
  const snapshot = await fetchBuildingSnapshot(
    {
      async tryGetPastObject(input) {
        assert.equal(typeof input.version, 'number')
        assert.equal(input.version, 807978009)

        return {
          result: createBuildingObjectResponse(),
          rpcUrl: 'https://rpc-a.example',
        }
      },
      async getObject() {
        throw new Error('getObject should not be called when past object succeeds')
      },
    },
    PACKAGE_ID,
    {
      objectId:
        '0xc70871445ebfe8e11483d29f5cc56596a786289b10f4a62077d80f1a05bed277',
      version: '807978009',
    },
    rpcUsage
  )

  assert.deepEqual(snapshot, {
    tenant: 'utopia',
    buildingItemId: '1000000019867',
    buildingObjectId:
      '0xc70871445ebfe8e11483d29f5cc56596a786289b10f4a62077d80f1a05bed277',
    moduleName: 'network_node',
    objectType: `${PACKAGE_ID}::network_node::NetworkNode`,
    typeId: '88092',
    ownerCapId:
      '0x799de410ceb035cb171a24fdb3168669beaca9d4e956ccac18a34b90a417c78b',
    status: 'OFFLINE',
    isActive: true,
  })
  assert.deepEqual(rpcUsage, ['https://rpc-a.example'])
})

test('fetchBuildingSnapshot falls back to getObject when tryGetPastObject rejects', async () => {
  const rpcUsage = []
  const snapshot = await fetchBuildingSnapshot(
    {
      async tryGetPastObject() {
        throw new Error('Invalid params')
      },
      async getObject(input) {
        assert.equal(
          input.id,
          '0xc70871445ebfe8e11483d29f5cc56596a786289b10f4a62077d80f1a05bed277'
        )

        return {
          result: createBuildingObjectResponse(),
          rpcUrl: 'https://rpc-b.example',
        }
      },
    },
    PACKAGE_ID,
    {
      objectId:
        '0xc70871445ebfe8e11483d29f5cc56596a786289b10f4a62077d80f1a05bed277',
      version: '807978009',
    },
    rpcUsage
  )

  assert.equal(snapshot?.buildingItemId, '1000000019867')
  assert.deepEqual(rpcUsage, ['https://rpc-b.example'])
})

test('fetchCharacterIdentityFromChange sends a numeric version to tryGetPastObject', async () => {
  const rpcUsage = []
  const snapshot = await fetchCharacterIdentityFromChange(
    {
      async tryGetPastObject(input) {
        assert.equal(typeof input.version, 'number')
        assert.equal(input.version, 807978009)

        return {
          result: createCharacterObjectResponse(),
          rpcUrl: 'https://rpc-c.example',
        }
      },
      async getObject() {
        throw new Error('getObject should not be called when past object succeeds')
      },
    },
    PACKAGE_ID,
    {
      objectId:
        '0x3e45062d6928cbc472c9006a1adc605872ac2e5a7877018d6d7816d9a326d426',
      version: '807978009',
    },
    rpcUsage
  )

  assert.deepEqual(snapshot, {
    tenant: 'utopia',
    characterItemId: '2112000244',
    characterObjectId:
      '0x3e45062d6928cbc472c9006a1adc605872ac2e5a7877018d6d7816d9a326d426',
    characterAddress:
      '0xc9aab3eebb8942bba72e5579d4a63c35d72c693a138e29e08b6732653715be54',
    sourceObjectVersion: '807978009',
  })
  assert.deepEqual(rpcUsage, ['https://rpc-c.example'])
})

test('fetchCharacterIdentityFromChange falls back to getObject when tryGetPastObject rejects', async () => {
  const rpcUsage = []
  const snapshot = await fetchCharacterIdentityFromChange(
    {
      async tryGetPastObject() {
        throw new Error('Invalid params')
      },
      async getObject(input) {
        assert.equal(
          input.id,
          '0x3e45062d6928cbc472c9006a1adc605872ac2e5a7877018d6d7816d9a326d426'
        )

        return {
          result: createCharacterObjectResponse(),
          rpcUrl: 'https://rpc-d.example',
        }
      },
    },
    PACKAGE_ID,
    {
      objectId:
        '0x3e45062d6928cbc472c9006a1adc605872ac2e5a7877018d6d7816d9a326d426',
      version: '807978009',
    },
    rpcUsage
  )

  assert.equal(snapshot?.characterItemId, '2112000244')
  assert.deepEqual(rpcUsage, ['https://rpc-d.example'])
})
