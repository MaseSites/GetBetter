/** Alle Werkzeuge an einer Stelle — dieselben fuer die App und fuer den Coach. */
const { createEngine } = require('./engine.js');
const { kitchenTools } = require('./kitchen.js');
const { readTools, trainingTools } = require('./training.js');

const ALL_TOOLS = [...kitchenTools, ...trainingTools, ...readTools];

const createTools = (ctx) => createEngine(ctx, ALL_TOOLS);

module.exports = { ALL_TOOLS, createTools };
