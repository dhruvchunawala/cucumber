import { Command } from 'commander'
import packageJson from '../package.json'
import loadSupportCode from './loadSupportCode'
import runCucumber from './runCucumber'
import {
  GherkinStreams,
  IGherkinOptions,
  Query as GherkinQuery,
} from '@cucumber/gherkin'
import fs from 'fs'
import makeFormatStream from './makeFormatStream'

const program = new Command()
program.version(packageJson.version)
program.option('-r, --require <path>', 'override require path')
program.option('--predictable-ids', 'Use predictable ids', false)
program.option(
  '--globals',
  'Assign Given/When/Then/After/Before to global scope',
  false
)
program.option(
  '-f, --format <format>',
  'output format: ndjson|protobuf',
  'protobuf'
)

async function main() {
  program.parse(process.argv)
  const { globals, predictableIds, format } = program

  const paths = program.args
  const requirePaths = program.require ? program.require.split(':') : paths

  const supportCode = await loadSupportCode(
    predictableIds,
    requirePaths,
    globals
  )

  const gherkinOptions: IGherkinOptions = {
    defaultDialect: 'en',
    newId: supportCode.newId,
    createReadStream: (path: string) =>
      fs.createReadStream(path, { encoding: 'utf-8' }),
  }
  const gherkinEnvelopeStream = GherkinStreams.fromPaths(paths, gherkinOptions)

  const envelopeOutputStream = makeFormatStream(format)
  envelopeOutputStream.pipe(process.stdout)
  const gherkinQuery = new GherkinQuery()

  await runCucumber(
    supportCode,
    gherkinEnvelopeStream,
    gherkinQuery,
    envelopeOutputStream
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
