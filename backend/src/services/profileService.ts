import { getDatabasePool } from '../config/database';

export interface UserProfile {
  id: string;
  cognito_sub: string;
  first_name: string | null;
  last_name: string | null;
  created_at: Date;
}

export async function getProfileByCognitoSub(cognitoSub: string): Promise<UserProfile | null> {
  const db = getDatabasePool();
  const result = await db.query(
    'SELECT * FROM user_profiles WHERE cognito_sub = $1',
    [cognitoSub]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0] as UserProfile;
}

export async function createOrUpdateProfile(
  cognitoSub: string,
  firstName?: string,
  lastName?: string
): Promise<UserProfile> {
  const db = getDatabasePool();
  
  // Try to update existing profile
  const updateResult = await db.query(
    `UPDATE user_profiles 
     SET first_name = COALESCE($1, first_name), 
         last_name = COALESCE($2, last_name)
     WHERE cognito_sub = $3
     RETURNING *`,
    [firstName || null, lastName || null, cognitoSub]
  );

  if (updateResult.rows.length > 0) {
    return updateResult.rows[0] as UserProfile;
  }

  // Create new profile if it doesn't exist
  const insertResult = await db.query(
    `INSERT INTO user_profiles (cognito_sub, first_name, last_name)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [cognitoSub, firstName || null, lastName || null]
  );

  return insertResult.rows[0] as UserProfile;
}

