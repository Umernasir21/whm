<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LoginHistory;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class UserController extends Controller
{
    public function index(Request $request)
    {
        return User::with('role:id,name,label')->latest()->paginate($request->integer('per_page', 20));
    }

    public function store(Request $request)
    {
        $d = $request->validate([
            'name' => ['required', 'string', 'max:128'],
            'email' => ['required', 'email', 'max:191', 'unique:users,email'],
            'role_id' => ['required', 'exists:roles,id'],
            'password' => ['required', Password::min(10)->mixedCase()->numbers()],
            'is_active' => ['boolean'],
        ]);

        return response()->json(User::create($d)->load('role'), 201);
    }

    public function update(Request $request, User $user)
    {
        $d = $request->validate([
            'name' => ['sometimes', 'string', 'max:128'],
            'email' => ['sometimes', 'email', 'max:191', Rule::unique('users', 'email')->ignore($user->id)],
            'role_id' => ['sometimes', 'exists:roles,id'],
            'password' => ['nullable', Password::min(10)->mixedCase()->numbers()],
            'is_active' => ['boolean'],
        ]);
        if (empty($d['password'])) {
            unset($d['password']);
        }
        $user->update($d);

        return $user->fresh('role');
    }

    public function destroy(Request $request, User $user)
    {
        abort_if($user->id === $request->user()->id, 422, 'You cannot delete your own account.');
        $user->delete();

        return response()->noContent();
    }

    public function loginHistory(Request $request)
    {
        return LoginHistory::with('user:id,name')->latest()->paginate($request->integer('per_page', 30));
    }

    public function roles()
    {
        return Role::with('permissions:id,name,label')->withCount('users')->get();
    }
}
