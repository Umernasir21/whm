<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Permission;
use App\Models\Role;
use Illuminate\Http\Request;

/**
 * Admin-only role administration: list roles with their permissions, the full
 * permission catalogue (grouped by module), and sync a role's permissions.
 * super_admin is locked to all permissions and cannot be edited.
 */
class RoleController extends Controller
{
    public function index()
    {
        return Role::with('permissions:id,name,label')->withCount('users')->orderBy('id')->get();
    }

    /** All permissions grouped by their module prefix (e.g. "sales_orders"). */
    public function permissions()
    {
        return Permission::orderBy('name')->get(['id', 'name', 'label'])
            ->groupBy(fn ($p) => explode('.', $p->name)[0]);
    }

    public function updatePermissions(Request $request, Role $role)
    {
        abort_if($role->name === 'super_admin', 422, 'The super admin role cannot be modified.');

        $data = $request->validate([
            'permissions' => ['present', 'array'],
            'permissions.*' => ['integer', 'exists:permissions,id'],
        ]);

        $role->permissions()->sync($data['permissions']);

        return $role->load('permissions:id,name,label');
    }
}
