import assert from 'assert'
import { messages, IdGenerator } from '@cucumber/messages'
import { stubInterface } from 'ts-sinon'
import IAstMaker from '../../src/IAstMaker'

import { ITable, IStep } from '../../src/behave/JSONSchema'
import { traverseTable, traverseDocstring, traverseStep } from '../../src/behave/JSONTraverse'
import IPredictableSupportCode from '../../src/IPredictableSupportCode'

describe('traverse elements', () => {
  context('traverseStep', () => {
    const simpleStep: IStep = {
      step_type: 'given',
      keyword: 'Given',
      name: 'a passed step',
      location: 'some.feature:3',
      match: {
        location: 'steps/some.py:5'
      },
      result: {
        status: 'failed',
        duration: 0.00016,
        error_message: 'Oups, that did not work'
      }
    }

    const docStringStep: IStep = {
      step_type: 'given',
      keyword: 'Given',
      name: 'a passed step',
      location: 'some.feature:3',
      match: {
        location: 'steps/some.py:5'
      },
      result: {
        status: 'passed',
      },
      text: 'This is the docstring content'
    }

    const datatableStep: IStep = {
      step_type: 'given',
      keyword: 'Given',
      name: 'a passed step',
      location: 'some.feature:3',
      match: {
        location: 'steps/some.py:5'
      },
      result: {
        status: 'passed',
      },
      table: {
        heading: ['name', 'price'],
        rows: [
          ['keyboard', '15'],
          ['mouse', '10']
        ]
      }
    }

    it('calls AstMaker.makeStep to produce the message', () => {
      const astMaker = stubInterface<IAstMaker>()
      const predictableSupportCode = stubInterface<IPredictableSupportCode>()

      traverseStep(
        simpleStep,
        astMaker,
        () => 'some-id',
        predictableSupportCode
      )

      assert.deepEqual(
        astMaker.makeStep.getCall(0).args,
        ['some-id', 3, 'Given ', 'a passed step', null, null]
      )
    })

    it('uses the DocString generated by traverseDocstring if available', () => {
      const astMaker = stubInterface<IAstMaker>()
      const predictableSupportCode = stubInterface<IPredictableSupportCode>()
      const docstring = messages.GherkinDocument.Feature.Step.DocString.create()
      astMaker.makeDocstring.returns(docstring)

      traverseStep(
        docStringStep,
        astMaker,
        () => 'some-id',
        predictableSupportCode
      )

      assert.deepEqual(
        astMaker.makeStep.getCall(0).args,
        ['some-id', 3, 'Given ', 'a passed step', docstring, null]
      )
    })

    it('uses the DataTable generated by traverseTable if available', () => {
      const astMaker = stubInterface<IAstMaker>()
      const predictableSupportCode = stubInterface<IPredictableSupportCode>()
      const datatable = messages.GherkinDocument.Feature.Step.DataTable.create()
      astMaker.makeDataTable.returns(datatable)

      traverseStep(
        datatableStep,
        astMaker,
        () => 'some-id',
        predictableSupportCode
      )

      assert.deepEqual(
        astMaker.makeStep.getCall(0).args,
        ['some-id', 3, 'Given ', 'a passed step', null, datatable]
      )
    })

    it('registers the step as a step definition', () => {
      const astMaker = stubInterface<IAstMaker>()
      const predictableSupportCode = stubInterface<IPredictableSupportCode>()
      astMaker.makeStep.returns(messages.GherkinDocument.Feature.Step.create({
        id: 'some-id'
      }))

      traverseStep(
        simpleStep,
        astMaker,
        () => 'some-id',
        predictableSupportCode
      )

      assert.deepEqual(
        predictableSupportCode.addPredictableStepDefinition.getCall(0).args,
        [
          'steps/some.py:5',
          'some-id',
          'failed',
          'Oups, that did not work'
        ]
      )
    })
  })

  context('traverseDocstring', () => {
    it('calls AstMaker.makeDocstring with only the text', () => {
      const astMaker = stubInterface<IAstMaker>()

      traverseDocstring('This is a doc string', astMaker)

      assert.deepEqual(
        astMaker.makeDocstring.getCall(0).args,
        [null, 'This is a doc string']
      )
    })
  })

  context('traverseTable', () => {
    const table: ITable = {
      heading: ['name', 'price'],
      rows: [
        ['keyboard', '15'],
        ['mouse', '10']
      ]
    }

    it('calls AtMaker.makeDatatable to create the correct AST element', () => {
      const astMaker = stubInterface<IAstMaker>()

      traverseTable(table, astMaker)

      assert.deepEqual(
        astMaker.makeDataTable.getCall(0).args,
        [
          [
            ['name', 'price'],
            ['keyboard', '15'],
            ['mouse', '10']
          ]
        ]
      )
    })
  })
})