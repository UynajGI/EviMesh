import { actors } from './actors.mjs';
import { actorProfiles } from './actor-profiles.mjs';
import { identities } from './identities.mjs';

export { actorProfiles } from './actor-profiles.mjs';
export { actors, actorType, identityStrength } from './actors.mjs';
export { identities } from './identities.mjs';

export const schema = { actors, actorProfiles, identities };

export default schema;
