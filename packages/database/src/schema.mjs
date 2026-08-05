import { actors } from './actors.mjs';
import { actorProfiles } from './actor-profiles.mjs';

export { actorProfiles } from './actor-profiles.mjs';
export { actors, actorType, identityStrength } from './actors.mjs';

export const schema = { actors, actorProfiles };

export default schema;
