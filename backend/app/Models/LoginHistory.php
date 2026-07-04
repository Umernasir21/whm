<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LoginHistory extends Model
{
    protected $table = 'login_history';
    public const UPDATED_AT = null;

    protected $fillable = [
        'user_id', 'email', 'successful', 'ip_address', 'user_agent',
    ];

    protected function casts(): array
    {
        return ['successful' => 'boolean', 'created_at' => 'datetime'];
    }
}
