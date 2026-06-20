// src/handlers/base.handler.js
class BaseHandler {
  async execute(entity, payload, ctx) {
    throw new Error(`${this.constructor.name} must implement execute()`)
  }
}

module.exports = BaseHandler
