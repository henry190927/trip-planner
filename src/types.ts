import type { z } from 'zod'
import type * as s from './schema'

// 型別全部由 schema.ts 推導，改資料格式只改那一個檔
export type Trip = z.infer<typeof s.tripSchema>
export type Traveler = z.infer<typeof s.travelerSchema>
export type Place = z.infer<typeof s.placeSchema>
export type Item = z.infer<typeof s.itemSchema>
export type ItemKind = Item['kind']
export type Day = z.infer<typeof s.daySchema>
export type Scene = Day['scene']
export type Flight = z.infer<typeof s.flightSchema>
export type Stay = z.infer<typeof s.staySchema>
export type Route = z.infer<typeof s.routeSchema>
export type RouteOption = z.infer<typeof s.routeOptionSchema>
export type Tip = z.infer<typeof s.tipSchema>
export type TipSection = z.infer<typeof s.tipSectionSchema>
export type ChecklistGroup = z.infer<typeof s.checklistGroupSchema>
export type MapProvider = Trip['mapProvider']
export type Spot = z.infer<typeof s.spotSchema>
export type SpotCategory = Spot['category']
export type OpenRange = z.infer<typeof s.openRangeSchema>
export type Alternative = z.infer<typeof s.alternativeSchema>
export type Trigger = Alternative['trigger']
