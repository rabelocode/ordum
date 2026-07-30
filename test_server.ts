import express from 'express';
import { testRouter } from './src/server/test_import';
console.log(testRouter ? "Router imported" : "Failed");
