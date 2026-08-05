import { actors } from './actors.mjs';
import { actorProfiles } from './actor-profiles.mjs';
import { identities } from './identities.mjs';
import { signingKeys } from './signing-keys.mjs';

export { actorProfiles } from './actor-profiles.mjs';
export { actors, actorType, identityStrength } from './actors.mjs';
export { identities } from './identities.mjs';
export { signingKeys } from './signing-keys.mjs';

export const schema = { actors, actorProfiles, identities, signingKeys };

export default schema;
