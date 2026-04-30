const { PrismaClient, RoleScope } = require('@prisma/client');
const bcrypt = require('bcrypt');
const { loadDotenv, applyDatabaseUrlToProcessEnv } = require('./apply-database-url.cjs');

loadDotenv();
applyDatabaseUrlToProcessEnv();

const prisma = new PrismaClient();

const ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL || 'admin@wms.local').toLowerCase();
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'password123';
const ADMIN_NAME = process.env.SEED_ADMIN_NAME || 'System Admin';

async function upsertRole(code, name, scope = RoleScope.OPERATIONAL) {
  return prisma.role.upsert({
    where: { code },
    update: { name, scope, isActive: true },
    create: { code, name, scope, isActive: true },
  });
}

async function upsertMenu(code, name, path, sortOrder, parentId = null) {
  return prisma.menu.upsert({
    where: { code },
    update: { name, path, sortOrder, parentId, isActive: true },
    create: { code, name, path, sortOrder, parentId, isActive: true },
  });
}

async function main() {
  const systemAdminRole = await upsertRole('SYSTEM_ADMIN', 'System Administrator', RoleScope.SYSTEM);
  const adminRole = await upsertRole('ADMIN', 'Administrator', RoleScope.SYSTEM);

  const dashboard = await upsertMenu('DASHBOARD', 'Dashboard', '/dashboard', 10);

  const mdParent = await upsertMenu('MASTER_DATA', 'Master Data', '/master-data/customers', 20);
  const mdCustomers = await upsertMenu('MD_CUSTOMERS', 'Customers', '/master-data/customers', 21, mdParent.id);
  const mdOperators = await upsertMenu('MD_OPERATORS', 'Operators', '/master-data/operators', 22, mdParent.id);
  const mdWarehouses = await upsertMenu('MD_WAREHOUSES', 'Warehouses', '/master-data/warehouses', 23, mdParent.id);
  const mdAreas = await upsertMenu('MD_AREAS', 'Areas', '/master-data/areas', 24, mdParent.id);
  const mdZones = await upsertMenu('MD_ZONES', 'Zones', '/master-data/zones', 25, mdParent.id);
  const mdBins = await upsertMenu('MD_BINS', 'Bins', '/master-data/bins', 26, mdParent.id);
  const mdUoms = await upsertMenu('MD_UOMS', 'UOMs', '/master-data/uoms', 27, mdParent.id);
  const mdProductUomConversions = await upsertMenu(
    'MD_PRODUCT_UOM_CONVERSIONS',
    'Product UOM Conversions',
    '/master-data/product-uom-conversions',
    28,
    mdParent.id,
  );
  const mdSuppliers = await upsertMenu('MD_SUPPLIERS', 'Suppliers', '/master-data/suppliers', 29, mdParent.id);
  const mdProducts = await upsertMenu('MD_PRODUCTS', 'Products', '/master-data/products', 30, mdParent.id);

  const inboundParent = await upsertMenu('INBOUND', 'Inbound', '/inbound/asn', 30);
  const inAsn = await upsertMenu('INBOUND_ASN', 'ASN', '/inbound/asn', 31, inboundParent.id);
  const inReceiving = await upsertMenu('INBOUND_RECEIVING', 'Receiving', '/inbound/receiving', 32, inboundParent.id);
  const inHistory = await upsertMenu('INBOUND_HISTORY', 'History', '/inbound/history', 33, inboundParent.id);

  const inventoryParent = await upsertMenu('INVENTORY', 'Inventory', '/inventory/balance', 34);
  const invBalance = await upsertMenu('INV_BALANCE', 'Inventory Balance', '/inventory/balance', 35, inventoryParent.id);

  const processParent = await upsertMenu('PROCESS_FLOW', 'Process Flow', '/process/transfers', 36);
  const processTransfers = await upsertMenu('PROCESS_TRANSFERS', 'Internal Transfers', '/process/transfers', 37, processParent.id);
  const processRecipes = await upsertMenu('PROCESS_RECIPES', 'Recipes (BOM)', '/process/recipes', 38, processParent.id);
  const processTransformations = await upsertMenu(
    'PROCESS_TRANSFORMATIONS',
    'Material Transformations',
    '/process/transformations',
    39,
    processParent.id,
  );
  const processActivity = await upsertMenu(
    'PROCESS_ACTIVITY',
    'Activity & billing',
    '/process/activity',
    40,
    processParent.id,
  );

  await prisma.menu.updateMany({
    where: { code: 'MD_INVENTORY' },
    data: { isActive: false },
  });

  const outboundParent = await upsertMenu('OUTBOUND', 'Outbound', '/outbound/sales-orders', 40);
  const obSalesOrders = await upsertMenu('OUTBOUND_SO', 'Sales orders', '/outbound/sales-orders', 41, outboundParent.id);
  const obAllocations = await upsertMenu('OUTBOUND_ALLOCATIONS', 'Allocations', '/outbound/sales-orders', 42, outboundParent.id);
  const obWaves = await upsertMenu('OUTBOUND_WAVES', 'Waves', '/outbound/waves', 43, outboundParent.id);
  const obTasks = await upsertMenu('OUTBOUND_TASKS', 'Tasks', '/outbound/tasks', 44, outboundParent.id);
  const obEvents = await upsertMenu('OUTBOUND_EVENTS', 'Events', '/outbound/sales-orders', 45, outboundParent.id);

  const billingParent = await upsertMenu('BILLING', 'Billing', '/billing/contracts', 50);
  const blContracts = await upsertMenu('BILLING_CONTRACTS', 'Contracts', '/billing/contracts', 51, billingParent.id);
  const blRates = await upsertMenu('BILLING_RATES', 'Rates', '/billing/rates', 52, billingParent.id);
  const blTransactions = await upsertMenu('BILLING_TRANSACTIONS', 'Transactions', '/billing/transactions', 53, billingParent.id);
  const blSummary = await upsertMenu('BILLING_SUMMARY', 'Summary', '/billing/summary', 54, billingParent.id);

  const accessParent = await upsertMenu('ACCESS_MANAGEMENT', 'Access Management', '/access/users', 60);
  const acUsers = await upsertMenu('ACCESS_USERS', 'Users', '/access/users', 61, accessParent.id);
  const acRoles = await upsertMenu('ACCESS_ROLES', 'Roles', '/access/roles', 62, accessParent.id);
  const acMenus = await upsertMenu('ACCESS_MENUS', 'Menus', '/access/menus', 63, accessParent.id);

  const allMenuIds = [
    dashboard.id,
    mdParent.id,
    mdCustomers.id,
    mdOperators.id,
    mdSuppliers.id,
    mdWarehouses.id,
    mdProducts.id,
    mdAreas.id,
    mdZones.id,
    mdBins.id,
    mdUoms.id,
    mdProductUomConversions.id,
    inventoryParent.id,
    invBalance.id,
    processParent.id,
    processTransfers.id,
    processRecipes.id,
    processTransformations.id,
    processActivity.id,
    inboundParent.id,
    inAsn.id,
    inReceiving.id,
    inHistory.id,
    outboundParent.id,
    obSalesOrders.id,
    obWaves.id,
    obTasks.id,
    obAllocations.id,
    obEvents.id,
    billingParent.id,
    blContracts.id,
    blRates.id,
    blTransactions.id,
    blSummary.id,
    accessParent.id,
    acUsers.id,
    acRoles.id,
    acMenus.id,
  ];

  await prisma.roleMenu.deleteMany({
    where: {
      roleId: { in: [systemAdminRole.id, adminRole.id] },
      menuId: { in: allMenuIds },
    },
  });

  await prisma.roleMenu.createMany({
    data: allMenuIds.flatMap((menuId) => [
      { roleId: systemAdminRole.id, menuId },
      { roleId: adminRole.id, menuId },
    ]),
    skipDuplicates: true,
  });

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const adminUser = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      name: ADMIN_NAME,
      passwordHash,
      isActive: true,
      canAccessWeb: true,
      canAccessMobile: true,
    },
    create: {
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      passwordHash,
      isActive: true,
      canAccessWeb: true,
      canAccessMobile: true,
    },
  });

  await prisma.userRole.deleteMany({
    where: {
      userId: adminUser.id,
      roleId: { in: [systemAdminRole.id, adminRole.id] },
    },
  });
  await prisma.userRole.createMany({
    data: [
      { userId: adminUser.id, roleId: systemAdminRole.id },
      { userId: adminUser.id, roleId: adminRole.id },
    ],
    skipDuplicates: true,
  });

  console.log('Access seed completed');
  console.log(`Admin email: ${ADMIN_EMAIL}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
