import { spawn, spawnSync } from 'child_process'
import { statSync, createReadStream } from 'fs'
import { ExeFile } from 'c21e'
import { messages, ProtobufMessageStream } from 'cucumber-messages'
import { Transform, Readable } from 'stream'
import legacy from './legacy'
import Dialect from './legacy/gherkin/Dialect'

const defaultOptions = {
  defaultDialect: 'en',
  includeSource: true,
  includeGherkinDocument: true,
  includePickles: true,
  useLegacyImplementation: false,
}

function translateLegacyOptions(
  options: IGherkinOptions
): IGherkinLegacyOptions {
  return {
    source: options.includeSource,
    'gherkin-document': options.includeGherkinDocument,
    pickle: options.includePickles,
  }
}

function fromPaths(paths: string[], options: IGherkinOptions = defaultOptions) {
  if (options.useLegacyImplementation) {
    throw new Error('FIXME')
    // const objectWrapper = new Transform({
    //   objectMode: true,
    //   transform(object, _, callback) {
    //     this.push(messages.Envelope.fromObject(object))
    //     callback()
    //   },
    // })
    //
    // const pipeEventsFor = ([path, ...rest]: string[]) => {
    //   if (!path) {
    //     return objectWrapper.end()
    //   }
    //
    //   const fileStream = createReadStream(path, { encoding: 'utf-8' })
    //   const eventStream = new legacy.EventStream(
    //     path,
    //     translateLegacyOptions(options)
    //   )
    //   fileStream.pipe(eventStream)
    //   eventStream.pipe(
    //     objectWrapper,
    //     { end: false }
    //   )
    //   eventStream.on('end', () => pipeEventsFor(rest))
    // }
    //
    // pipeEventsFor(paths)
    //
    // return objectWrapper
  } else {
    return new GherkinExe(paths, [], options).messageStream()
  }
}

function fromSources(
  sources: messages.Source[],
  options: Omit<IGherkinOptions, 'useLegacyImplementation'> = defaultOptions
) {
  return new GherkinExe([], sources, options).messageStream()
}

function dialects(options: IGherkinOptions = defaultOptions) {
  if (options.useLegacyImplementation) {
    return legacy.DIALECTS
  } else {
    return new GherkinExe([], [], {}).dialects()
  }
}

interface IGherkinOptions {
  defaultDialect?: string
  includeSource?: boolean
  includeGherkinDocument?: boolean
  includePickles?: boolean
  useLegacyImplementation?: boolean
}

interface IGherkinLegacyOptions {
  source?: boolean
  'gherkin-document'?: boolean
  pickle?: boolean
}

export { fromPaths, fromSources, dialects, legacy }

class GherkinExe {
  private exeFile: ExeFile

  constructor(
    private readonly paths: string[],
    private readonly sources: messages.Source[],
    private readonly options: IGherkinOptions
  ) {
    this.options = { ...defaultOptions, ...options }
    let executables = `${__dirname}/../../executables`
    try {
      statSync(executables)
    } catch (err) {
      // Dev mode - we're in src, not dist/src
      executables = `${__dirname}/../executables`
      statSync(executables)
    }
    this.exeFile = new ExeFile(
      `${executables}/gherkin-{{.OS}}-{{.Arch}}{{.Ext}}`
    )
    statSync(this.exeFile.fileName)
  }

  public dialects(): { [key: string]: Dialect } {
    const result = spawnSync(this.exeFile.fileName, ['--dialects'])
    return JSON.parse(result.stdout)
  }

  public messageStream(): Readable {
    const options = ['--default-dialect', this.options.defaultDialect]
    if (!this.options.includeSource) {
      options.push('--no-source')
    }
    if (!this.options.includeGherkinDocument) {
      options.push('--no-ast')
    }
    if (!this.options.includePickles) {
      options.push('--no-pickles')
    }
    const args = options.concat(this.paths)
    const gherkin = spawn(this.exeFile.fileName, args)
    const protobufMessageStream = new ProtobufMessageStream(
      messages.Envelope.decodeDelimited.bind(messages.Envelope)
    )
    gherkin.on('error', err => {
      protobufMessageStream.emit('error', err)
    })
    gherkin.stdout.pipe(protobufMessageStream)
    for (const source of this.sources) {
      const envelope = messages.Envelope.fromObject({ source })
      gherkin.stdin.write(messages.Envelope.encodeDelimited(envelope).finish())
    }
    gherkin.stdin.end()
    return protobufMessageStream
  }
}
