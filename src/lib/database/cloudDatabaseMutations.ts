"use client";

import {
  addField as addLocalField,
  addRow as addLocalRow,
  addView as addLocalView,
  createDatabase as createLocalDatabase,
  deleteDatabase as deleteLocalDatabase,
  deleteField as deleteLocalField,
  deleteRow as deleteLocalRow,
  deleteView as deleteLocalView,
  getAllDatabaseRecordsForSync,
  getPage,
  updateDatabase as updateLocalDatabase,
  updateField as updateLocalField,
  updateRow as updateLocalRow,
  updateView as updateLocalView,
  type RemoteDatabaseRecord,
} from "@/lib/db/local/queries";
import {
  queueCloudDatabaseRecords,
  queueCloudDatabaseRecordsForKeys,
} from "@/lib/database/accountDatabaseSync";
import { emitDatabasesUpdated } from "@/lib/database/databaseUpdateBus";
import { queueCloudPagePush } from "@/lib/pages/accountPageSync";
import type {
  Database,
  DatabaseField,
  DatabaseRow,
  DatabaseView,
} from "@/lib/utils/types";

type CreateDatabaseOptions = Parameters<typeof createLocalDatabase>[0];
type UpdateDatabaseOptions = Parameters<typeof updateLocalDatabase>[1];
type AddFieldOptions = Parameters<typeof addLocalField>[1];
type UpdateFieldOptions = Parameters<typeof updateLocalField>[1];
type AddRowOptions = Parameters<typeof addLocalRow>[1];
type UpdateRowOptions = Parameters<typeof updateLocalRow>[1];
type AddViewOptions = Parameters<typeof addLocalView>[1];
type UpdateViewOptions = Parameters<typeof updateLocalView>[1];

function databaseRecord(database: Database): RemoteDatabaseRecord {
  return {
    type: "database",
    id: database.id,
    database_id: database.id,
    parent_page_id: database.parent_page_id,
    page_id: null,
    owner_id: database.owner_id,
    title: database.title,
    icon: database.icon,
    description: database.description,
    name: null,
    field_type: null,
    view_type: null,
    config: null,
    field_values: null,
    position: 0,
    created_at: database.created_at,
    updated_at: database.updated_at,
    deleted_at: database.deleted_at,
  };
}

function fieldRecord(field: DatabaseField): RemoteDatabaseRecord {
  return {
    type: "field",
    id: field.id,
    database_id: field.database_id,
    parent_page_id: null,
    page_id: null,
    owner_id: field.owner_id,
    title: null,
    icon: null,
    description: null,
    name: field.name,
    field_type: field.field_type,
    view_type: null,
    config: field.config,
    field_values: null,
    position: field.position,
    created_at: field.created_at,
    updated_at: field.updated_at,
    deleted_at: field.deleted_at,
  };
}

function rowRecord(row: DatabaseRow): RemoteDatabaseRecord {
  return {
    type: "row",
    id: row.id,
    database_id: row.database_id,
    parent_page_id: null,
    page_id: row.page_id,
    owner_id: row.owner_id,
    title: null,
    icon: null,
    description: null,
    name: null,
    field_type: null,
    view_type: null,
    config: null,
    field_values: row.field_values,
    position: row.position,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

function viewRecord(view: DatabaseView): RemoteDatabaseRecord {
  return {
    type: "view",
    id: view.id,
    database_id: view.database_id,
    parent_page_id: null,
    page_id: null,
    owner_id: view.owner_id,
    title: null,
    icon: null,
    description: null,
    name: view.name,
    field_type: null,
    view_type: view.view_type,
    config: view.config,
    field_values: null,
    position: view.position,
    created_at: view.created_at,
    updated_at: view.updated_at,
    deleted_at: view.deleted_at,
  };
}

function notifyDatabaseMutation(count = 1): void {
  emitDatabasesUpdated("local-refresh", count);
}

async function queueRecordsForDatabase(databaseId: string): Promise<void> {
  const records = (await getAllDatabaseRecordsForSync()).filter(
    (record) => record.database_id === databaseId
  );
  queueCloudDatabaseRecords(records);
  notifyDatabaseMutation(records.length);
}

async function queueKeys(keys: string[], count = keys.length): Promise<void> {
  await queueCloudDatabaseRecordsForKeys(keys);
  notifyDatabaseMutation(count);
}

export async function createDatabaseWithCloud(
  opts: CreateDatabaseOptions
): Promise<Database> {
  const database = await createLocalDatabase(opts);
  await queueRecordsForDatabase(database.id);
  return database;
}

export async function updateDatabaseWithCloud(
  id: string,
  updates: UpdateDatabaseOptions
): Promise<Database | null> {
  const database = await updateLocalDatabase(id, updates);
  if (database && Object.keys(updates).length > 0) {
    queueCloudDatabaseRecords([databaseRecord(database)]);
    notifyDatabaseMutation();
  }
  return database;
}

export async function deleteDatabaseWithCloud(id: string): Promise<void> {
  await deleteLocalDatabase(id);
  await queueKeys([`database:${id}`]);
}

export async function addFieldWithCloud(
  databaseId: string,
  opts: AddFieldOptions
): Promise<DatabaseField> {
  const field = await addLocalField(databaseId, opts);
  queueCloudDatabaseRecords([fieldRecord(field)]);
  notifyDatabaseMutation();
  return field;
}

export async function updateFieldWithCloud(
  id: string,
  updates: UpdateFieldOptions
): Promise<void> {
  await updateLocalField(id, updates);
  if (Object.keys(updates).length > 0) {
    await queueKeys([`field:${id}`]);
  }
}

export async function deleteFieldWithCloud(id: string): Promise<void> {
  await deleteLocalField(id);
  await queueKeys([`field:${id}`]);
}

export async function addRowWithCloud(
  databaseId: string,
  opts?: AddRowOptions
): Promise<DatabaseRow> {
  const row = await addLocalRow(databaseId, opts);
  queueCloudDatabaseRecords([rowRecord(row)]);
  const page = await getPage(row.page_id);
  if (page) queueCloudPagePush(page);
  notifyDatabaseMutation();
  return row;
}

export async function updateRowWithCloud(
  id: string,
  updates: UpdateRowOptions
): Promise<void> {
  await updateLocalRow(id, updates);
  if (Object.keys(updates).length > 0) {
    await queueKeys([`row:${id}`]);
  }
}

export async function deleteRowWithCloud(id: string): Promise<void> {
  await deleteLocalRow(id);
  await queueKeys([`row:${id}`]);
}

export async function addViewWithCloud(
  databaseId: string,
  opts: AddViewOptions
): Promise<DatabaseView> {
  const view = await addLocalView(databaseId, opts);
  queueCloudDatabaseRecords([viewRecord(view)]);
  notifyDatabaseMutation();
  return view;
}

export async function updateViewWithCloud(
  id: string,
  updates: UpdateViewOptions
): Promise<void> {
  await updateLocalView(id, updates);
  if (Object.keys(updates).length > 0) {
    await queueKeys([`view:${id}`]);
  }
}

export async function deleteViewWithCloud(id: string): Promise<void> {
  await deleteLocalView(id);
  await queueKeys([`view:${id}`]);
}

export {
  addFieldWithCloud as addField,
  addRowWithCloud as addRow,
  addViewWithCloud as addView,
  createDatabaseWithCloud as createDatabase,
  deleteDatabaseWithCloud as deleteDatabase,
  deleteFieldWithCloud as deleteField,
  deleteRowWithCloud as deleteRow,
  deleteViewWithCloud as deleteView,
  updateDatabaseWithCloud as updateDatabase,
  updateFieldWithCloud as updateField,
  updateRowWithCloud as updateRow,
  updateViewWithCloud as updateView,
};
