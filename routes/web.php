<?php

use Illuminate\Support\Facades\Route;

Route::get('/test-react', function () {
    return view('test');
});

// Catch-all: serve the React app for all routes (React Router handles frontend navigation)
Route::get('/{any}', function () {
    return view('app');
})->where('any', '.*');
