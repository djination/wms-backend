/**
 * Extend this port with adapter implementations (SAP, TMS, e-commerce, etc.).
 * Keeps domain/application free of vendor SDKs.
 */
export const THIRD_PARTY_CONNECTOR = Symbol('THIRD_PARTY_CONNECTOR');

export interface ThirdPartyConnectorPort {
  pushStockSnapshot(payload: unknown): Promise<void>;
}
