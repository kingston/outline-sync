export interface DocumentCollection {
  /**
   * The unique identifier for the collection
   */
  id: string;
  /**
   * The URL ID of the collection
   */
  urlId: string;
  /**
   * The name of the collection
   */
  name: string;
  /**
   * The description of the collection
   */
  description: string | null;
}
