import { join } from 'path';

export const PROTO_DIR = join(__dirname, '..', 'src', 'proto');
export const PROTO_INCLUDE_DIRS = [PROTO_DIR];

export const AUTH_PACKAGE_NAME = 'auth';
export const AUTH_PROTO_PATH = join(PROTO_DIR, 'auth', 'auth.proto');

export const ORDER_PACKAGE_NAME = 'order';
export const ORDER_PROTO_PATH = join(PROTO_DIR, 'order', 'order.proto');

export const PROFILE_PACKAGE_NAME = 'profile';
export const PROFILE_PROTO_PATH = join(PROTO_DIR, 'profile', 'profile.proto');

export const COMMON_PACKAGE_NAME = 'common';
export const COMMON_METADATA_PROTO_PATH = join(PROTO_DIR, 'common', 'metadata.proto');
export const COMMON_PAGINATION_PROTO_PATH = join(PROTO_DIR, 'common', 'pagination.proto');
export const COMMON_ERRORS_PROTO_PATH = join(PROTO_DIR, 'common', 'errors.proto');
