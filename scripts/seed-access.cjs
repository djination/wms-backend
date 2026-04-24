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
  const mdSuppliers = await upsertMenu('MD_SUPPLIERS', 'Suppliers', '/master-data/suppliers', 23, mdParent.id);
  const mdWarehouses = await upsertMenu('MD_WAREHOUSES', 'Warehouses', '/master-data/warehouses', 24, mdParent.id);
  const mdProducts = await upsertMenu('MD_PRODUCTS', 'Products', '/master-data/products', 25, mdParent.id);

  const inventoryParent = await upsertMenu('INVENTORY', 'Inventory', '/inventory/balance', 25);
  const invBalance = await upsertMenu('INV_BALANCE', 'Inventory Balance', '/inventory/balance', 26, inventoryParent.id);

  await prisma.menu.updateMany({
    where: { code: 'MD_INVENTORY' },
    data: { isActive: false },
  });

  const inboundParent = await upsertMenu('INBOUND', 'Inbound', '/inbound/asn', 30);
  const inAsn = await upsertMenu('INBOUND_ASN', 'ASN', '/inbound/asn', 31, inboundParent.id);
  const inReceiving = await upsertMenu('INBOUND_RECEIVING', 'Receiving', '/inbound/receiving', 32, inboundParent.id);
  const inHistory = await upsertMenu('INBOUND_HISTORY', 'History', '/inbound/history', 33, inboundParent.id);

  const outboundParent = await upsertMenu('OUTBOUND', 'Outbound', '/outbound/sales-orders', 35);
  const obSalesOrders = await upsertMenu('OUTBOUND_SO', 'Sales orders', '/outbound/sales-orders', 36, outboundParent.id);
  const obWaves = await upsertMenu('OUTBOUND_WAVES', 'Waves', '/outbound/waves', 37, outboundParent.id);
  const obTasks = await upsertMenu('OUTBOUND_TASKS', 'Tasks', '/outbound/tasks', 38, outboundParent.id);

  const billingParent = await upsertMenu('BILLING', 'Billing', '/billing/contracts', 39);
  const blContracts = await upsertMenu('BILLING_CONTRACTS', 'Contracts', '/billing/contracts', 391, billingParent.id);
  const blRates = await upsertMenu('BILLING_RATES', 'Rates', '/billing/rates', 392, billingParent.id);
  const blTransactions = await upsertMenu('BILLING_TRANSACTIONS', 'Transactions', '/billing/transactions', 393, billingParent.id);
  const blSummary = await upsertMenu('BILLING_SUMMARY', 'Summary', '/billing/summary', 394, billingParent.id);

  const accessParent = await upsertMenu('ACCESS_MANAGEMENT', 'Access Management', '/access/users', 40);
  const acUsers = await upsertMenu('ACCESS_USERS', 'Users', '/access/users', 41, accessParent.id);
  const acRoles = await upsertMenu('ACCESS_ROLES', 'Roles', '/access/roles', 42, accessParent.id);
  const acMenus = await upsertMenu('ACCESS_MENUS', 'Menus', '/access/menus', 43, accessParent.id);

  const allMenuIds = [
    dashboard.id,
    mdParent.id,
    mdCustomers.id,
    mdOperators.id,
    mdSuppliers.id,
    mdWarehouses.id,
    mdProducts.id,
    inventoryParent.id,
    invBalance.id,
    inboundParent.id,
    inAsn.id,
    inReceiving.id,
    inHistory.id,
    outboundParent.id,
    obSalesOrders.id,
    obWaves.id,
    obTasks.id,
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
    update: { name: ADMIN_NAME, passwordHash, isActive: true },
    create: { email: ADMIN_EMAIL, name: ADMIN_NAME, passwordHash, isActive: true },
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
