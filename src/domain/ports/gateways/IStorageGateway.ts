export interface IStorageGateway {
  upload(userId: string, examId: string, file: File): Promise<string>; // returns URL
  delete(path: string): Promise<void>;
  getSignedUrl(path: string, expiresIn?: number): Promise<string>;
}
