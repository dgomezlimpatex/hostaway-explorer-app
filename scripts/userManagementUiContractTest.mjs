import fs from 'node:fs';

const file = fs.readFileSync('src/components/admin/UserManagement.tsx', 'utf8');

const requiredContracts = [
  ['all roles are grouped per user', 'roles: UserRoleAssignment[]'],
  ['role priority is explicit', 'const rolePriority'],
  ['role mutation preserves multiple roles', 'rolesToAdd'],
  ['role mutation prevents empty permissions', 'Un usuario debe conservar al menos un rol.'],
  ['last admin protection exists', 'No se puede retirar el último administrador'],
  ['role management dialog is visible', 'Gestionar roles'],
  ['role descriptions are visible', 'roleDescriptions'],
  ['user search is visible', 'Buscar usuarios'],
  ['role filter is visible', 'Todos los roles'],
  ['sede management dialog is visible', 'Gestionar sedes'],
  ['global admin sede access is explained', 'Acceso global'],
  ['sede refresh waits for mutation success', "onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user-sede-access'] })"],
  ['role update writes user_roles', ".from('user_roles')"],
];

for (const [name, marker] of requiredContracts) {
  if (!file.includes(marker)) {
    throw new Error(`Missing UserManagement contract: ${name} (${marker})`);
  }
}

console.log(`User management UI contract passed (${requiredContracts.length} checks)`);
