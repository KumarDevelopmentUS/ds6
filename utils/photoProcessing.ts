// utils/photoProcessing.ts
// This file is OPTIONAL - you can delete it entirely if you don't need image resizing
import { Image as RNImage } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

interface PhotoDimensions {
  width: number;
  height: number;
}

export class PhotoProcessor {
  /**
   * Get dimensions of an image
   */
  static async getImageDimensions(uri: string): Promise<PhotoDimensions> {
    return new Promise((resolve, reject) => {
      RNImage.getSize(
        uri,
        (width, height) => resolve({ width, height }),
        (error) => reject(error)
      );
    });
  }

  /**
   * Resize an image using expo-image-manipulator
   */
  static async resizeImage(uri: string, targetWidth: number, targetHeight: number): Promise<string> {
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: targetWidth, height: targetHeight } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      
      return result.uri;
    } catch (error) {
      console.error('Error resizing image:', error);
      throw error;
    }
  }

  /**
   * Crop an image using expo-image-manipulator
   */
  static async cropImage(
    uri: string, 
    cropData: { x: number; y: number; width: number; height: number }
  ): Promise<string> {
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{
          crop: {
            originX: cropData.x,
            originY: cropData.y,
            width: cropData.width,
            height: cropData.height
          }
        }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      
      return result.uri;
    } catch (error) {
      console.error('Error cropping image:', error);
      throw error;
    }
  }
}